import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import mondaySdk from 'monday-sdk-js';
import { MenuButton } from '@vibe/core';

// Import necessary hooks and components
import { useMondayAPI } from './hooks/useMondayAPI';
import {
    GET_BOARDS_QUERY,
    GET_BOARD_COLUMNS_QUERY,
    GET_BOARD_ITEMS_WITH_COLUMNS_QUERY,
    UPDATE_ITEM_NAME_QUERY,
    UPDATE_COLUMN_VALUE_QUERY
} from './api/mondayQueries';
import Sidebar from './components/Sidebar/Sidebar';
import TaskTable from './components/TaskTable/TaskTable';

// Initialize Monday SDK
const monday = mondaySdk();

// Helper function for exponential backoff retry
// Increased initial delay and retries for better handling of concurrency limits
const retry = async (fn, retries = 5, delay = 2000, factor = 2) => {
    try {
        return await fn();
    } catch (error) {
        // Log the error for debugging
        console.error(`Retry attempt failed (retries left: ${retries}):`, error);

        // Check if it's a concurrency limit error or a general API error that might benefit from retry
        const isConcurrencyError = error.message && error.message.includes("Concurrency limit exceeded");
        const isGraphqlError = error.message && error.message.includes("Graphql validation errors");
        const isRateLimitStatusCode = error.response && error.response.status === 429;
        const errorExtensions = error.response && error.response.errors && error.response.errors[0] && error.response.errors[0].extensions;
        const isFieldLimitExceededCode = errorExtensions && errorExtensions.code === "FIELD_LIMIT_EXCEEDED";

        if (retries > 0 && (isConcurrencyError || isGraphqlError || isRateLimitStatusCode || isFieldLimitExceededCode)) {
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise(res => setTimeout(res, delay));
            return retry(fn, retries - 1, delay * factor, factor);
        } else {
            throw error;
        }
    }
};

function App() {
    // Use custom hook for Monday API interaction
    const { queryMonday } = useMondayAPI();

    // State to control sidebar visibility
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // Ref for the menu button, so the sidebar can be positioned relative to it
    const menuButtonRef = useRef(null);

    // States to store IDs of selected boards and columns
    const [selectedBoardIds, setSelectedBoardIds] = useState([]);
    const [selectedColumnIds, setSelectedColumnIds] = useState([]);

    // States to store data about all boards and board items
    const [allBoardsData, setAllBoardsData] = useState({});
    const [boardItems, setBoardItems] = useState([]);

    // --- NEW STATES FOR LAZY LOADING BOARDS IN SIDEBAR ---
    const [allAvailableBoardsForSidebar, setAllAvailableBoardsForSidebar] = useState([]);
    const [isFetchingAllBoardsForSidebar, setIsFetchingAllBoardsForSidebar] = useState(false);
    const [allBoardsForSidebarFetchError, setAllBoardsForSidebarFetchError] = useState(null);
    // --- END NEW STATES ---

    // States for application and data loading indication
    const [isAppLoading, setIsAppLoading] = useState(true); // Initial app settings loading
    const [isLoadingColumns, setIsLoadingColumns] = useState(false); // Columns loading (e.g., after filter change)
    const [isLoadingItems, setIsLoadingItems] = useState(false); // Items loading (e.g., after filter change)
    const [isPolling, setIsPolling] = useState(false); // NEW: State for background periodic refresh

    // States for error handling
    const [appError, setAppError] = useState(null);
    const [columnsError, setColumnsError] = useState(null);
    const [itemsError, setItemsError] = useState(null);

    // Function to fetch all necessary data (columns and items) for selected boards
    // This function will now manage only its own internal loading (isPolling) and errors,
    // as well as updating the actual data.
    const fetchBoardData = useCallback(async () => {
        if (selectedBoardIds.length === 0) {
            console.log("App.jsx: fetchBoardData - No boards selected, skipping data fetch.");
            setAllBoardsData({});
            setBoardItems([]);
            setColumnsError(null);
            setItemsError(null);
            // Don't set isLoadingColumns/Items to false here, as they are managed by the useEffect.
            return;
        }

        // Set polling state on start
        setIsPolling(true);
        setColumnsError(null);
        setItemsError(null);

        const newAllBoardsData = {};
        let fetchedItems = [];

        try {
            // Fetch columns first
            const columnsData = await retry(() => queryMonday(GET_BOARD_COLUMNS_QUERY));

            if (columnsData && columnsData.boards) {
                columnsData.boards.forEach(board => {
                    if (selectedBoardIds.includes(board.id)) {
                        newAllBoardsData[board.id] = {
                            id: board.id,
                            name: board.name,
                            columns: board.columns || [],
                        };
                    }
                });
            }
            setAllBoardsData(newAllBoardsData);

            // Then fetch items for each selected board
            for (const boardId of selectedBoardIds) {
                if (selectedColumnIds.length === 0) {
                    console.warn(`App.jsx: No columns selected for board ${boardId}, skipping item fetch for this board.`);
                    continue;
                }

                const query = GET_BOARD_ITEMS_WITH_COLUMNS_QUERY(String(boardId), selectedColumnIds);
                const itemsData = await retry(() => queryMonday(query));

                if (itemsData && itemsData.boards && itemsData.boards[0] && itemsData.boards[0].items_page && itemsData.boards[0].items_page.items) {
                    const itemsWithBoardInfo = itemsData.boards[0].items_page.items.map(item => ({
                        ...item,
                        boardId: boardId,
                        boardName: newAllBoardsData[boardId]?.name || `Board ${boardId}`
                    }));
                    fetchedItems = [...fetchedItems, ...itemsWithBoardInfo];
                } else {
                    console.warn(`App.jsx: No items found for board ${boardId}.`);
                }
            }
            setBoardItems(fetchedItems);

        } catch (error) {
            console.error("App.jsx: Error loading board data (columns or items):", error);
            if (error.message.includes("columns")) { // Try to identify if it was a columns-related error
                setColumnsError(`Error loading columns: ${error.message}. Please check selected boards.`);
            } else { // Otherwise, assume it's items or general error
                setItemsError(`Error loading items: ${error.message}.`);
            }
        } finally {
            // Set polling state off regardless of success or failure
            setIsPolling(false);
            // IMPORTANT: isLoadingColumns and isLoadingItems are NOT set here.
            // They are managed by the specific useEffect that triggers initial/filtered loads.
        }
    }, [selectedBoardIds, selectedColumnIds, queryMonday]);

    // Effect to load application settings from monday.storage on initial render
    useEffect(() => {
        const loadSettings = async () => {
            try {
                setIsAppLoading(true);
                setAppError(null);

                const response = await monday.storage.instance.getItem('appSettings');
                const settingsString = response && response.data ? response.data.value : null;

                console.log("App.jsx: Loaded raw settings string from storage:", settingsString);

                if (settingsString) {
                    if (typeof settingsString === 'string') {
                        try {
                            const parsedSettings = JSON.parse(settingsString);
                            console.log("App.jsx: Loaded parsed settings:", parsedSettings);
                            if (parsedSettings.selectedBoardIds) {
                                setSelectedBoardIds(parsedSettings.selectedBoardIds);
                            }
                            if (parsedSettings.selectedColumnIds) {
                                setSelectedColumnIds(parsedSettings.selectedColumnIds);
                            }
                            if (typeof parsedSettings.isDialogOpen !== 'undefined') {
                                setIsSidebarOpen(parsedSettings.isDialogOpen);
                            } else if (typeof parsedSettings.isPopoverOpen !== 'undefined') {
                                setIsSidebarOpen(parsedSettings.isPopoverOpen);
                            } else if (typeof parsedSettings.isSidebarOpen !== 'undefined') {
                                setIsSidebarOpen(parsedSettings.isSidebarOpen);
                            }
                        } catch (jsonParseError) {
                            console.warn("App.jsx: Settings found in storage but not a valid JSON string. Clearing faulty data.", jsonParseError);
                            if (monday.storage.instance.removeItem && typeof monday.storage.instance.removeItem === 'function') {
                                await monday.storage.instance.removeItem('appSettings');
                                console.log("App.jsx: Cleared potentially corrupted settings.");
                            } else {
                                console.error("App.jsx: monday.storage.instance.removeItem is not available. Cannot clear corrupted data.");
                            }
                        }
                    } else {
                        console.warn("App.jsx: Settings found in storage but not a string type. Clearing faulty data.");
                        if (monday.storage.instance.removeItem && typeof monday.storage.instance.removeItem === 'function') {
                            await monday.storage.instance.removeItem('appSettings');
                            console.log("App.jsx: Cleared potentially corrupted settings.");
                        } else {
                            console.error("App.jsx: monday.storage.instance.removeItem is not available. Cannot clear corrupted data.");
                            }
                    }
                } else {
                    console.log("App.jsx: No existing settings found in storage or value is null/undefined.");
                }
            } catch (err) {
                console.error("App.jsx: Error loading settings from Monday storage:", err);
                setAppError("Error loading settings: " + err.message);
                if (monday.storage.instance.removeItem && typeof monday.storage.instance.removeItem === 'function') {
                    try {
                        await monday.storage.instance.removeItem('appSettings');
                        console.log("App.jsx: Cleared potentially corrupted settings due to load error.");
                    } catch (clearError) {
                        console.error("App.jsx: Error clearing corrupted settings after load error:", clearError);
                    }
                } else {
                    console.warn("App.jsx: monday.storage.instance.removeItem is not available. Cannot clear corrupted data on error.");
                }
            } finally {
                setIsAppLoading(false);
            }
        };
        loadSettings();
    }, []);

    // Effect for automatic saving of settings to monday.storage when relevant states change
    useEffect(() => {
        // Save settings only after initial app loading is complete
        if (!isAppLoading) {
            const saveSettingsAutomatically = async () => {
                const settingsToSave = {
                    selectedBoardIds,
                    selectedColumnIds,
                    isSidebarOpen,
                };
                try {
                    await monday.storage.instance.setItem('appSettings', JSON.stringify(settingsToSave));
                    console.log("App.jsx: Settings automatically saved:", settingsToSave);
                } catch (error) {
                    console.error("App.jsx: Error saving settings automatically:", error);
                    if (monday.toast && typeof monday.toast.error === 'function') {
                        monday.toast.error(`Auto-save error: ${error.message}`);
                    }
                }
            };
            saveSettingsAutomatically();
        }
    }, [selectedBoardIds, selectedColumnIds, isSidebarOpen, isAppLoading]);

    // Effect to trigger data fetching when selectedBoardIds or selectedColumnIds change, or app loading completes
    // This useEffect is now responsible for setting the "full loading" indicators.
    useEffect(() => {
        const loadContentData = async () => {
            if (!isAppLoading) {
                // Set full loading states BEFORE calling fetchBoardData
                setIsLoadingColumns(true);
                setIsLoadingItems(true);
                // Call fetchBoardData, which now handles its own isPolling state
                await fetchBoardData();
                // Turn off full loading states AFTER fetchBoardData completes
                setIsLoadingColumns(false);
                setIsLoadingItems(false);
            }
        };
        loadContentData();
    }, [selectedBoardIds, selectedColumnIds, isAppLoading, fetchBoardData]);

    useEffect(() => {
        const pollingInterval = 20000; // 20 seconds

        const intervalId = setInterval(() => {
            console.log(`App.jsx: Polling for updates (every ${pollingInterval / 1000} seconds)...`);
            // Only fetch data if the app is not already loading data (initial/filter load)
            // and if there are selected boards and columns (to avoid unnecessary API calls)
            if (!isAppLoading && !isLoadingColumns && !isLoadingItems && selectedBoardIds.length > 0 && selectedColumnIds.length > 0) {
                fetchBoardData(); // fetchBoardData will handle setting and unsetting isPolling
            } else if (selectedBoardIds.length === 0 || selectedColumnIds.length === 0) {
                console.log("App.jsx: Skipping polling - no boards or columns selected.");
            } else if (isAppLoading || isLoadingColumns || isLoadingItems) {
                console.log("App.jsx: Skipping polling - data is currently loading from initial/filter change.");
            }
        }, pollingInterval);

        // Cleanup function to clear the interval when the component unmounts
        return () => {
            console.log("App.jsx: Clearing polling interval.");
            clearInterval(intervalId);
        };
    }, [fetchBoardData, isAppLoading, isLoadingColumns, isLoadingItems, selectedBoardIds, selectedColumnIds]); // Dependencies to re-setup interval if fetchBoardData, loading state, or selections change

    const fetchBoardsForSidebarSelection = useCallback(async () => {
        if (isFetchingAllBoardsForSidebar) return;

        setIsFetchingAllBoardsForSidebar(true);
        setAllBoardsForSidebarFetchError(null);
        try {
            const data = await retry(() => queryMonday(GET_BOARDS_QUERY));
            if (data && data.boards) {
                setAllAvailableBoardsForSidebar(data.boards);
                console.log("App.jsx: Fetched all boards for sidebar:", data.boards);
            }
        } catch (error) {
            console.error("App.jsx: Error fetching all boards for sidebar:", error);
            setAllBoardsForSidebarFetchError(`Error loading all boards: ${error.message}`);
            if (monday.toast && typeof monday.toast.error === 'function') {
                monday.toast.error(`Error loading all boards for menu: ${error.message}`);
            }
        } finally {
            setIsFetchingAllBoardsForSidebar(false);
        }
    }, [queryMonday, isFetchingAllBoardsForSidebar]);


    // Handlers for board selection
    const handleBoardToggle = useCallback((boardId) => {
        setSelectedBoardIds(prev =>
            prev.includes(boardId)
                ? prev.filter(id => id !== boardId)
                : [...prev, boardId]
        );
    }, []);

    const handleSelectAllBoards = useCallback(async () => {
        if (allAvailableBoardsForSidebar.length > 0) {
            const allIds = allAvailableBoardsForSidebar.map(board => board.id);
            setSelectedBoardIds(allIds);
            if (monday.toast && typeof monday.toast.success === 'function') {
                monday.toast.success('All available boards selected!');
            }
            return;
        }

        setIsLoadingColumns(true);
        setAllBoardsForSidebarFetchError(null);
        try {
            const data = await retry(() => queryMonday(GET_BOARDS_QUERY));
            if (data && data.boards) {
                const allIds = data.boards.map(board => board.id);
                setSelectedBoardIds(allIds);
                setAllAvailableBoardsForSidebar(data.boards);
                if (monday.toast && typeof monday.toast.success === 'function') {
                    monday.toast.success('All available boards selected!');
                }
            }
        } catch (error) {
            console.error("App.jsx: Error selecting all boards:", error);
            setAllBoardsForSidebarFetchError(`Error selecting all boards: ${error.message}`);
            if (monday.toast && typeof monday.toast.error === 'function') {
                monday.toast.error(`Error selecting all boards: ${error.message}`);
            }
        } finally {
            setIsLoadingColumns(false);
        }
    }, [queryMonday, setSelectedBoardIds, allAvailableBoardsForSidebar]);

    const handleDeselectAllBoards = useCallback(() => {
        setSelectedBoardIds([]);
        if (monday.toast && typeof monday.toast.info === 'function') {
            monday.toast.info('All boards deselected.');
        }
    }, []);

    // Memoized list of all available columns for selected boards (duplicates removed by ID)
    const allAvailableColumnsForSelectedBoards = useMemo(() => {
        const columnsMap = new Map();
        selectedBoardIds.forEach(boardId => {
            if (allBoardsData[boardId] && allBoardsData[boardId].columns) {
                allBoardsData[boardId].columns.forEach(col => {
                    if (!columnsMap.has(col.id)) {
                        columnsMap.set(col.id, col);
                    }
                });
            }
        });
        return Array.from(columnsMap.values());
    }, [selectedBoardIds, allBoardsData]);

    // Handlers for column selection
    const handleColumnToggle = useCallback((columnId) => {
        setSelectedColumnIds(prev =>
            prev.includes(columnId)
                ? prev.filter(id => id !== columnId)
                : [...prev, columnId]
        );
    }, []);

    const handleSelectAllColumns = useCallback(() => {
        const allColumnIds = allAvailableColumnsForSelectedBoards.map(col => col.id);
        setSelectedColumnIds(allColumnIds);
        if (monday.toast && typeof monday.toast.success === 'function') {
            monday.toast.success('All available fields selected!');
        }
    }, [allAvailableColumnsForSelectedBoards]);

    const handleDeselectAllColumns = useCallback(() => {
        setSelectedColumnIds([]);
        if (monday.toast && typeof monday.toast.info === 'function') {
            monday.toast.info('All fields deselected.');
        }
    }, []);

    // Memoized list of columns to display in TaskTable, including 'Board' and 'Item Name' columns
    const columnsToDisplayInTable = useMemo(() => {
        const filteredColumns = allAvailableColumnsForSelectedBoards.filter(col => selectedColumnIds.includes(col.id));

        // Define static columns for board name and item name
        const boardNameColumn = {
            id: 'board_name_column',
            title: 'Board',
            type: 'board_name'
        };

        const itemNameColumn = {
            id: 'item_name_column',
            title: 'Task Name', // Changed from Item Name to Task Name for consistency
            type: 'item_name'
        };

        // Return combined list of columns
        return [boardNameColumn, itemNameColumn, ...filteredColumns];
    }, [allAvailableColumnsForSelectedBoards, selectedColumnIds]);

    // Determine if content (columns or items) is loading for initial/filter changes
    const isContentLoading = isLoadingColumns || isLoadingItems;

    /**
     * Callback function for TaskTable to signal that an item has been updated.
     * This triggers a re-fetch of all relevant data.
     * @param {string} updatedBoardId - The ID of the board where the item was updated.
     * @param {string} updatedItemId - The ID of the item that was updated.
     */
    const handleItemUpdated = useCallback(async (updatedBoardId, updatedItemId) => {
        console.log(`Item updated: Board ID ${updatedBoardId}, Item ID ${updatedItemId}. Re-fetching data...`);
        // Re-fetch all data to ensure consistency after an explicit update
        await fetchBoardData();
    }, [fetchBoardData]);

    // Function to toggle sidebar visibility
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => {
            const newSidebarState = !prev;
            if (newSidebarState && allAvailableBoardsForSidebar.length === 0 && !isFetchingAllBoardsForSidebar) {
                fetchBoardsForSidebarSelection();
            }
            return newSidebarState;
        });
    }, [allAvailableBoardsForSidebar, isFetchingAllBoardsForSidebar, fetchBoardsForSidebarSelection]);

    // Effect to control document body overflow when sidebar is open/closed
    useEffect(() => {
        // Prevent body scroll when sidebar is open
        document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
        // Cleanup function
        return () => {
            document.body.style.overflow = '';
        };
    }, [isSidebarOpen]);

    if (isAppLoading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '1.2em', color: '#333' }}>
                <p>Loading app settings...</p>
            </div>
        );
    }

    if (appError) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontSize: '1.2em' }}>
                <p>Error: {appError}</p>
                <p>Please try reloading the app or contact support.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', flexDirection: 'column' }}>
            <div
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 101,
                }}
            >
                <MenuButton
                    ref={menuButtonRef}
                    onClick={toggleSidebar}
                    style={{ minWidth: '120px' }}
                >
                    {isSidebarOpen ? 'Close Settings' : 'Open Settings'}
                </MenuButton>
            </div>

            <div style={{
                flex: 1,
                padding: '20px',
                paddingTop: '60px', 
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'hidden',
            }}>
                <h1 style={{ marginBottom: '20px', color: '#222' }}>Monday.com Board Data</h1>

                {/* Main Content Loading Indicator */}
                {isContentLoading ? ( // This shows for initial load or filter changes
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <p style={{ fontSize: '1.2em', color: '#555' }}>Loading board data...</p>
                    </div>
                ) : (
                    <>
                        {/* Error Messages */}
                        {columnsError && <p style={{ color: 'red', marginBottom: '10px' }}>{columnsError}</p>}
                        {itemsError && <p style={{ color: 'red', marginBottom: '10px' }}>{itemsError}</p>}


                        {selectedBoardIds.length === 0 ? (
                            <p style={{ color: '#777' }}>Please select one or more boards in the settings dialog to view data.</p>
                        ) : selectedColumnIds.length === 0 ? (
                            <p style={{ color: '#777' }}>Please select one or more columns in the settings dialog to view data.</p>
                        ) : boardItems.length === 0 ? ( // This EmptyState is for when no items exist after loading
                            <p style={{ color: '#777' }}>No items to display with the selected boards and columns.</p>
                        ) : (
                            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0, marginBottom: '20px' }}>
                                <TaskTable
                                    columnIds={columnsToDisplayInTable.map(col => col.id)}
                                    allBoardColumns={columnsToDisplayInTable}
                                    boardItems={boardItems}
                                    onItemUpdated={handleItemUpdated}
                                    // isLoading and error props are no longer directly used by TaskTable for its primary loader/error state.
                                    // App.jsx now manages these states and passes the data directly.
                                    // You can pass `false` or remove the prop as TaskTable's internal loader is removed.
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    right: isSidebarOpen ? 0 : '-100%',
                    width: 'max-content',
                    maxWidth: '90vw',
                    height: '100vh',
                    backgroundColor: 'white',
                    boxShadow: '0px 0px 20px rgba(0, 0, 0, 0.2)',
                    zIndex: 100,
                    transition: 'right 0.3s ease-out',
                    overflowY: 'auto',
                    padding: '20px',
                    boxSizing: 'border-box',
                }}
            >
                <Sidebar
                    allAvailableBoards={allAvailableBoardsForSidebar}
                    isFetchingAllBoards={isFetchingAllBoardsForSidebar}
                    allBoardsFetchError={allBoardsForSidebarFetchError}
                    onBoardToggle={handleBoardToggle}
                    selectedBoardIds={selectedBoardIds}
                    allBoardColumns={allAvailableColumnsForSelectedBoards}
                    selectedColumnIds={selectedColumnIds}
                    onColumnToggle={handleColumnToggle}
                    onSelectAllBoards={handleSelectAllBoards}
                    onDeselectAllBoards={handleDeselectAllBoards}
                    onSelectAllColumns={handleSelectAllColumns}
                    onDeselectAllColumns={handleDeselectAllColumns}
                />
            </div>
        </div>
    );
}

export default App;