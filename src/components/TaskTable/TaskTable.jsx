// TaskTable.jsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Table,
    TableHeader,
    TableHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    EmptyState,
    AttentionBox,
    Loader,
    Avatar,
    AvatarGroup,
    Button,
    Dialog,
    DialogContentContainer,
    Flex,
    Divider,
    Link,
    Heading,
    Text,
    Icon,
    Checkbox,
} from '@vibe/core';

import { Filter } from '@vibe/icons';


import mondaySdk from 'monday-sdk-js';
import { useMondayAPI } from '../../hooks/useMondayAPI';
import { GET_USER_DETAILS_QUERY, UPDATE_COLUMN_VALUE_QUERY, UPDATE_ITEM_NAME_QUERY } from '../../api/mondayQueries';

import './TaskTable.css';

const monday = mondaySdk();

const getStatusColorStyle = (statusText) => {
    const lowerCaseStatus = String(statusText || '').trim().toLowerCase();
    switch (lowerCaseStatus) {
        case 'done':
        case 'completed':
            return { backgroundColor: '#00c875', color: '#fff' };
        case 'working on it':
        case 'in progress':
        case 'working':
            return { backgroundColor: '#fdab3d', color: '#fff' };
        case 'stuck':
        case 'blocked':
            return { backgroundColor: '#e2445c', color: '#fff' };
        case 'not started':
        case 'ready':
            return { backgroundColor: '#a1a1a1', color: '#fff' };
        default:
            if (lowerCaseStatus === '' || lowerCaseStatus === 'undefined' || lowerCaseStatus === 'null' || lowerCaseStatus === '-') {
                return { backgroundColor: '#c4c4c4', color: '#323338', border: '1px solid #b0b0b0' };
            }
            return {
                backgroundColor: '#e0e0e0',
                color: '#323338',
                border: '1px solid #d0d0d0'
            };
    }
};

const TableErrorState = () => (
    <AttentionBox
        title="Error loading data"
        text="An error occurred while loading data. Please try refreshing the page or contact support."
        type="danger"
        style={{ margin: '20px' }}
    />
);

function TaskTable({ columnIds, allBoardColumns, boardItems, onItemUpdated }) {
    const { queryMonday } = useMondayAPI();

    const [editingItemId, setEditingItemId] = useState(null);
    const [editedItemName, setEditedItemName] = useState('');
    const [mondayBaseUrl, setMondayBaseUrl] = useState('https://monday.com');
    const [cachedUsers, setCachedUsers] = useState({});
    const [currentUserId, setCurrentUserId] = useState(null);

    const [cellDialogState, setCellDialogState] = useState({
        isOpen: false,
        item: null,
        column: null,
        user: null,
        anchorEl: null,
        isHeader: false,
        isHover: false,
    });

    const [sorting, setSorting] = useState({});
    const [activeFilters, setActiveFilters] = useState({});

    const itemNameInputRef = useRef(null);
    const dialogHoverTimeoutRef = useRef(null);

    useEffect(() => {
        if (editingItemId !== null && itemNameInputRef.current) {
            itemNameInputRef.current.focus();
        }
    }, [editingItemId]);

    useEffect(() => {
        const fetchContextAndUserId = async () => {
            try {
                const context = await monday.get('context');
                if (context && context.data && context.data.userId) {
                    setCurrentUserId(context.data.userId);
                }
            } catch (err) {
                console.error("TaskTable.jsx: Error getting Monday context for current user:", err);
            }
        };
        fetchContextAndUserId();
    }, []);

    useEffect(() => {
        const fetchMondayBaseUrl = async () => {
            try {
                const context = await monday.get('context');
                if (context && context.data && context.data.accountUrl) {
                    setMondayBaseUrl(context.data.account.url);
                } else {
                    const response = await monday.api(`query { account { slug } }`);
                    if (response && response.data && response.data.account && response.data.account.slug) {
                        const accountSlug = response.data.account.slug;
                        const defaultUrl = `https://${accountSlug}.monday.com`;
                        setMondayBaseUrl(defaultUrl);
                    }
                }
            } catch (err) {
                console.error("TaskTable.jsx: Error getting Monday context or account slug:", err);
            }
        };
        fetchMondayBaseUrl();
    }, []);

    const fetchAndCacheUser = useCallback(async (userId) => {
        if (!userId) {
            return { id: null, name: 'Unknown', photo_original: null };
        }
        if (cachedUsers[userId]) {
            return cachedUsers[userId];
        }

        try {
            const data = await queryMonday(GET_USER_DETAILS_QUERY(userId));
            if (data && data.users && data.users.length > 0) {
                const user = data.users[0];
                setCachedUsers(prev => ({ ...prev, [userId]: user }));
                return user;
            }
            setCachedUsers(prev => ({ ...prev, [userId]: { id: userId, name: 'Unknown', photo_original: null } }));
            return { id: userId, name: 'Unknown', photo_original: null };
        } catch (error) {
            console.error(`TaskTable.jsx: Error getting user details for ID ${userId}:`, error);
            setCachedUsers(prev => ({ ...prev, [userId]: { id: userId, name: 'Unknown', photo_original: null } }));
            return { id: userId, name: 'Unknown', photo_original: null };
        }
    }, [cachedUsers, queryMonday]);

    useEffect(() => {
        const userIdsToFetch = new Set();
        boardItems.forEach(item => {
            item.column_values.forEach(cv => {
                const columnMeta = allBoardColumns.find(col => col.id === cv.id);
                if (columnMeta && (columnMeta.type === 'person' || columnMeta.type === 'people')) {
                    if (cv.value && String(cv.value).trim() !== '') {
                        try {
                            const parsedValue = JSON.parse(cv.value);
                            let persons = [];
                            if (parsedValue && parsedValue.personsAndTeams && Array.isArray(parsedValue.personsAndTeams)) {
                                persons = parsedValue.personsAndTeams.filter(p => p.kind === 'person');
                            } else if (Array.isArray(parsedValue)) {
                                persons = parsedValue.filter(p => p.kind === 'person');
                            }
                            persons.forEach(p => {
                                if (p.id && !cachedUsers[p.id]) {
                                    userIdsToFetch.add(p.id);
                                    fetchAndCacheUser(p.id);
                                }
                            });
                        } catch (e) {
                            // Error parsing person column value, ignore.
                        }
                    }
                }
            });
        });
    }, [boardItems, allBoardColumns, fetchAndCacheUser, cachedUsers]);


    const handleDoubleClick = useCallback((itemId, currentName) => {
        setEditingItemId(itemId);
        setEditedItemName(currentName);
    }, []);

    const handleSaveEdit = useCallback(async (itemId, boardId, currentName) => {
        if (editingItemId === itemId) {
            if (editedItemName.trim() !== '' && editedItemName.trim() !== currentName) {
                try {
                    await queryMonday(UPDATE_ITEM_NAME_QUERY(boardId, itemId, editedItemName.trim()));
                    const updatedItem = boardItems.find(item => item.id === itemId && item.boardId === boardId);
                    if (typeof onItemUpdated === 'function' && updatedItem) {
                        await onItemUpdated(updatedItem.boardId, updatedItem.id);
                    }
                } catch (err) {
                    alert('An error occurred while updating the item name. Please try again.');
                    console.error('Error updating item name:', err);
                }
            }
            setEditingItemId(null);
            setEditedItemName('');
        }
    }, [editingItemId, editedItemName, queryMonday, onItemUpdated, boardItems]);

    const handleKeyDown = useCallback((e, itemId, boardId, currentName) => {
        if (e.key === 'Enter') {
            handleSaveEdit(itemId, boardId, currentName);
        } else if (e.key === 'Escape') {
            setEditingItemId(null);
            setEditedItemName('');
        }
    }, [handleSaveEdit]);

    const onSort = useCallback((columnId, sortState) => {
        setSorting({
            [columnId]: sortState,
        });
    }, []);

    const handleFilterChange = useCallback((columnId, value, isChecked) => {
        setActiveFilters(prevFilters => {
            const currentColumnFilters = prevFilters[columnId] || [];
            if (isChecked) {
                return {
                    ...prevFilters,
                    [columnId]: [...currentColumnFilters, value],
                };
            } else {
                return {
                    ...prevFilters,
                    [columnId]: currentColumnFilters.filter(v => v !== value),
                };
            }
        });
    }, []);

    const handleClearFilter = useCallback((columnId) => {
        setActiveFilters(prevFilters => {
            const newFilters = { ...prevFilters };
            delete newFilters[columnId];
            return newFilters;
        });
    }, []);

    const columnsForTable = useMemo(() => {
        const virtualColumns = [
            { id: 'item_name_column', title: 'Task Name', type: 'item_name' },
            { id: 'board_name_column', title: 'Board', type: 'board_link' },
        ];

        const orderedColumnMetas = columnIds.map(colId => {
            const virtualCol = virtualColumns.find(vc => vc.id === colId);
            if (virtualCol) return virtualCol;
            return allBoardColumns.find(col => col.id === colId);
        }).filter(Boolean);

        return orderedColumnMetas.map(col => {
            let columnData = {
                id: col.id,
                title: col.title,
                type: col.type,
            };

            if (col.type === 'status' && col.settings_str) {
                try {
                    const settings = JSON.parse(col.settings_str);
                    if (settings && settings.labels) {
                        columnData.statusOptions = Object.entries(settings.labels).map(([key, value]) => ({
                            id: key,
                            label: value,
                            value: value,
                            color: settings.labels_colors ? (settings.labels_colors[key]?.color || getStatusColorStyle(value).backgroundColor) : getStatusColorStyle(value).backgroundColor
                        }));
                        columnData.statusOptions.push({
                            id: 'clear',
                            label: 'No status',
                            value: '',
                            color: '#c4c4c4'
                        });
                    }
                } catch (e) {
                    console.warn(`Error parsing settings for status column ${col.id}:`, e);
                }
            }
            return columnData;
        });
    }, [columnIds, allBoardColumns]);


    const redirectToUserProfile = useCallback((userId) => {
        if (userId) {
            const userProfileUrl = `${mondayBaseUrl}/users/${userId}`;
            window.open(userProfileUrl, '_blank');
        }
    }, [mondayBaseUrl]);

    const handleStatusChange = useCallback(async (selectedOption, item, columnMeta) => {
        setCellDialogState({ isOpen: false, item: null, column: null, anchorEl: null, isHeader: false, user: null, isHover: false });

        const selectedStatusText = selectedOption ? selectedOption.label : '';

        let valueToSend;
        if (selectedOption && selectedOption.id === 'clear') {
            valueToSend = JSON.stringify({ label: '' });
        }
        else {
            valueToSend = JSON.stringify({ label: selectedStatusText });
        }

        const currentColumnValue = item.column_values.find(cv => cv.id === columnMeta.id);
        const currentStatusText = String(currentColumnValue ? currentColumnValue.text : '').trim();

        const normalizedCurrentStatusText = (currentStatusText === '-' || currentStatusText === 'undefined' || currentStatusText === 'null' || currentStatusText === '') ? 'No status' : currentStatusText;

        let needsUpdate = false;
        if (selectedOption && selectedOption.id === 'clear') {
            if (normalizedCurrentStatusText !== 'No status') {
                needsUpdate = true;
            }
        } else {
            if (selectedStatusText.trim() !== normalizedCurrentStatusText) {
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            try {
                await queryMonday(UPDATE_COLUMN_VALUE_QUERY(item.boardId, item.id, columnMeta.id, valueToSend));
                if (typeof onItemUpdated === 'function') {
                    await onItemUpdated(item.boardId, item.id);
                }
            } catch (err) {
                alert('An error occurred while updating the status. Please try again.');
                console.error('Error updating status:', err);
            }
        }
    }, [queryMonday, onItemUpdated]);

    const handleCellDialogClick = useCallback((event, item, columnMeta) => {
        setCellDialogState({
            isOpen: true,
            item: item,
            column: columnMeta,
            user: null,
            anchorEl: event.currentTarget,
            isHeader: false,
            isHover: false,
        });
    }, []);

    const handleAvatarMouseEnter = useCallback((event, user) => {
        if (dialogHoverTimeoutRef.current) {
            clearTimeout(dialogHoverTimeoutRef.current);
        }
        setCellDialogState({
            isOpen: true,
            item: null,
            column: null,
            user: user,
            anchorEl: event.currentTarget,
            isHeader: false,
            isHover: true,
        });
    }, []);

    const handleAvatarMouseLeave = useCallback(() => {
        dialogHoverTimeoutRef.current = setTimeout(() => {
            setCellDialogState({ isOpen: false, item: null, column: null, user: null, anchorEl: null, isHeader: false, isHover: false });
        }, 100);
    }, []);


    const renderUserDetailsDialogContent = useCallback((user) => {
        if (!user || (!user.name && !user.email && !user.id)) {
            return (
                <DialogContentContainer style={{ padding: '8px', minWidth: '200px', backgroundColor: 'white' }}>
                    <Flex direction={Flex.directions.COLUMN} gap={Flex.gaps.XSMALL} className="user-details-dialog-content">
                        <Heading type="h4" color="primary" style={{textAlign: 'center'}}>Loading user data...</Heading>
                        <Text type="text2" color="secondary" style={{textAlign: 'center'}}>Please wait or data not available.</Text>
                    </Flex>
                </DialogContentContainer>
            );
        }
        return (
            <DialogContentContainer
                style={{ padding: '8px', minWidth: '200px', backgroundColor: 'white' }}
                onMouseEnter={() => clearTimeout(dialogHoverTimeoutRef.current)}
                onMouseLeave={handleAvatarMouseLeave}
            >
                <Flex direction={Flex.directions.COLUMN} gap={Flex.gaps.XSMALL} className="user-details-dialog-content">
                    <Flex justify={Flex.justify.CENTER} className="user-avatar-section" style={{marginBottom: '4px'}}>
                        <Avatar
                            type={user.photo_original ? Avatar.types.IMG : Avatar.types.TEXT}
                            src={user.photo_original || undefined}
                            text={user.name ? user.name.substring(0, 2).toUpperCase() : 'NP'}
                            size="large"
                            ariaLabel={user.name || 'User Avatar'}
                        />
                    </Flex>
                    <Heading type="h3" color="primary" className="user-details-name" style={{textAlign: 'center', margin: '0'}}>{user.name || 'Unknown User'}</Heading>
                    {user.title && <Text type="text2" color="secondary" style={{textAlign: 'center'}}>{user.title}</Text>}

                    {user.email && (
                        <>
                            <Divider style={{ margin: '8px 0' }} />
                            <Button
                                onClick={() => window.open(`mailto:${user.email}`, '_blank')}
                                kind={Button.kinds.TERTIARY}
                                style={{
                                    justifyContent: 'flex-start',
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: 'var(--primary-text-color)',
                                }}
                            >
                                <Text type="text2" color="primary">{user.email}</Text>
                            </Button>
                        </>
                    )}

                    <Divider style={{ margin: '8px 0' }} />
                    <Button
                        onClick={() => redirectToUserProfile(user.id)}
                        kind={Button.kinds.PRIMARY}
                        size="small"
                        style={{width: '100%'}}
                    >
                        View Profile
                    </Button>
                </Flex>
            </DialogContentContainer>
        );
    }, [redirectToUserProfile, handleAvatarMouseLeave]);


    const filteredAndSortedBoardItems = useMemo(() => {
        if (!boardItems || boardItems.length === 0) {
            return [];
        }

        let itemsToProcess = [...boardItems];

        let filteredByCurrentUser = itemsToProcess;
        const isFilterByCurrentUserActive = activeFilters['current_user_filter'] && activeFilters['current_user_filter'].includes('true');

        if (isFilterByCurrentUserActive && currentUserId) {
            filteredByCurrentUser = itemsToProcess.filter(item => {
                const isUserMentioned = item.column_values.some(cv => {
                    const columnMeta = allBoardColumns.find(col => col.id === cv.id);
                    if (columnMeta && (columnMeta.type === 'person' || columnMeta.type === 'people')) {
                        if (cv.value && String(cv.value).trim() !== '') {
                            try {
                                const parsedValue = JSON.parse(cv.value);
                                let persons = [];
                                if (parsedValue && parsedValue.personsAndTeams && Array.isArray(parsedValue.personsAndTeams)) {
                                    persons = parsedValue.personsAndTeams.filter(p => p.kind === 'person');
                                } else if (Array.isArray(parsedValue)) {
                                    persons = parsedValue.filter(p => p.kind === 'person');
                                }
                                return persons.some(p => p.id && String(p.id) === String(currentUserId));
                            } catch (e) {
                                return false;
                            }
                        }
                    }
                    return false;
                });
                return isUserMentioned;
            });
        }

        let finalFilteredItems = filteredByCurrentUser.filter(item => {
            return Object.entries(activeFilters).every(([columnId, selectedValues]) => {
                if (columnId === 'current_user_filter') return true;

                if (!selectedValues || selectedValues.length === 0) {
                    return true;
                }

                const columnMeta = columnsForTable.find(col => col.id === columnId);
                if (!columnMeta) {
                    return true;
                }

                const itemColumnValue = item.column_values.find(cv => cv.id === columnId);

                switch (columnMeta.type) {
                    case 'status': {
                        const currentStatusText = String(itemColumnValue ? itemColumnValue.text : '').trim();
                        const normalizedCurrentStatusText = (currentStatusText === '-' || currentStatusText === 'undefined' || currentStatusText === 'null' || currentStatusText === '') ? 'No status' : currentStatusText;
                        return selectedValues.includes(normalizedCurrentStatusText);
                    }
                    case 'person':
                    case 'people': {
                        if (!itemColumnValue || !itemColumnValue.value || String(itemColumnValue.value).trim() === '') {
                            return selectedValues.includes('No user');
                        }
                        try {
                            const parsedValue = JSON.parse(itemColumnValue.value);
                            let persons = [];
                            if (parsedValue && parsedValue.personsAndTeams && Array.isArray(parsedValue.personsAndTeams)) {
                                persons = parsedValue.personsAndTeams.filter(p => p.kind === 'person');
                            } else if (Array.isArray(parsedValue)) {
                                persons = parsedValue.filter(p => p.kind === 'person');
                            }
                            return persons.some(p => p.id && selectedValues.includes(String(p.id)));
                        } catch (e) {
                            return false;
                        }
                    }
                    default:
                        const itemValueText = String(itemColumnValue ? (itemColumnValue.display_value || itemColumnValue.text || '') : '').trim();
                        return selectedValues.some(val => itemValueText.includes(val));
                }
            });
        });


        const sortColumnId = Object.keys(sorting)[0];
        const sortOrder = sorting[sortColumnId];

        if (!sortColumnId || !sortOrder) {
            return finalFilteredItems;
        }

        const columnMeta = columnsForTable.find(col => col.id === sortColumnId);
        if (!columnMeta) {
            return finalFilteredItems;
        }

        const sortedItems = [...finalFilteredItems].sort((a, b) => {
            let valueA, valueB;

            if (sortColumnId === 'item_name_column') {
                valueA = a.name || '';
                valueB = b.name || '';
            } else if (sortColumnId === 'board_name_column') {
                valueA = a.boardName || '';
                valueB = b.boardName || '';
            } else {
                const columnValueA = a.column_values.find(cv => cv.id === sortColumnId);
                const columnValueB = b.column_values.find(cv => cv.id === sortColumnId);

                valueA = String(columnValueA ? (columnValueA.display_value || columnValueA.text || '') : '');
                valueB = String(columnValueB ? (columnValueB.display_value || columnValueB.text || '') : '');

                switch (columnMeta.type) {
                    case 'numbers':
                        valueA = parseFloat(valueA) || 0;
                        valueB = parseFloat(valueB) || 0;
                        break;
                    case 'date':
                        valueA = columnValueA && columnValueA.text ? new Date(columnValueA.text) : new Date(0);
                        valueB = columnValueB && columnValueB.text ? new Date(columnValueB.text) : new Date(0);
                        break;
                    case 'link':
                        try {
                            const parsedA = columnValueA && columnValueA.value ? JSON.parse(columnValueA.value) : null;
                            const parsedB = columnValueB && columnValueB.value ? JSON.parse(columnValueB.value) : null;
                            valueA = parsedA?.url || parsedA?.text || '';
                            valueB = parsedB?.url || parsedB?.text || '';
                        } catch (e) {
                            valueA = columnValueA?.text || '';
                            valueB = columnValueB?.text || '';
                        }
                        break;
                    case 'person':
                    case 'people':
                        try {
                            const parsedA = columnValueA && columnValueA.value ? JSON.parse(columnValueA.value) : null;
                            const parsedB = columnValueB && columnValueB.value ? JSON.parse(columnValueB.value) : null;
                            const personsA = parsedA && parsedA.personsAndTeams ? parsedA.personsAndTeams.filter(p => p.kind === 'person') : [];
                            const personsB = parsedB && parsedB.personsAndTeams ? parsedB.personsAndTeams.filter(p => p.kind === 'person') : [];
                            valueA = personsA.length > 0 ? (cachedUsers[personsA[0].id]?.name || '') : '';
                            valueB = personsB.length > 0 ? (cachedUsers[personsB[0].id]?.name || '') : '';
                        } catch (e) {
                            valueA = columnValueA?.text || '';
                            valueB = columnValueB?.text || '';
                        }
                        break;
                    default:
                        break;
                }
            }

            let comparison = 0;
            if (columnMeta.type === 'date') {
                comparison = valueA.getTime() - valueB.getTime();
            } else if (typeof valueA === 'string' && typeof valueB === 'string') {
                comparison = valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: 'base' });
            } else if (typeof valueA === 'number' && typeof valueB === 'number') {
                comparison = valueA - valueB;
            } else {
                comparison = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' });
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return sortedItems;
    }, [boardItems, sorting, columnsForTable, cachedUsers, activeFilters, currentUserId, allBoardColumns]);


    const RowRenderer = useCallback((item) => {
        return (
            <TableRow key={item.id} className="monday-table-row small-row">
                {columnsForTable.map(columnMeta => {
                    const columnId = columnMeta.id;
                    const columnType = columnMeta.type;

                    let displayContent = <Text type="text2" color="secondary"></Text>;
                    const columnValue = item.column_values.find(cv => cv.id === columnId);

                    let cellClassName = 'monday-table-cell monday-cell-border';
                    if (columnId === 'board_name_column' || columnId === 'item_name_column') {
                        cellClassName += ' main-column-cell';
                    } else if (columnType === 'status') {
                        cellClassName += ' status-column-cell';
                    } else if (columnType === 'person' || columnType === 'people') {
                        cellClassName += ' person-column-cell';
                    } else if (columnType === 'date') {
                        cellClassName += ' date-column-cell';
                    }

                    if (columnId === 'board_name_column') {
                        const boardUrl = `${mondayBaseUrl}/boards/${item.boardId}`;
                        displayContent = (
                            <Link
                                text={item.boardName || 'Unknown Board'}
                                href={boardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                color="primary"
                                iconPosition="end"
                                inlineText
                                inheritFontSize
                            />
                        );
                    } else if (columnId === 'item_name_column') {
                        let currentItemName = item.name || 'Untitled';

                        const rubyHashRegex = /^{\"text\"=>\"(.*?)\"}$/;
                        const match = String(currentItemName).match(rubyHashRegex);
                        if (match && match[1]) {
                            currentItemName = match[1];
                        }

                        displayContent = (
                            <>
                                {editingItemId === item.id ? (
                                    <div className="monday-edit-item-name-container">
                                        <input
                                            type="text"
                                            value={editedItemName}
                                            onChange={(e) => setEditedItemName(e.target.value)}
                                            onBlur={() => handleSaveEdit(item.id, item.boardId, currentItemName)}
                                            onKeyDown={(e) => handleKeyDown(e, item.id, item.boardId, currentItemName)}
                                            ref={itemNameInputRef}
                                            className="monday-item-name-input"
                                        />
                                        <button
                                            onClick={() => handleSaveEdit(item.id, item.boardId, currentItemName)}
                                            className="monday-save-button"
                                            title="Save"
                                        >
                                            ✓
                                        </button>
                                    </div>
                                ) : (
                                    <Text
                                        onDoubleClick={() => monday.execute('openItemCard', { itemId: parseInt(item.id), boardId: parseInt(item.boardId) })}
                                        className="monday-item-name-display"
                                        type="text2"
                                        color="primary"
                                        element="span"
                                    >
                                        {currentItemName}
                                    </Text>
                                )}
                            </>
                        );
                    } else if (columnType === 'status') {
                        const currentStatusText = String(columnValue ? columnValue.text : '').trim();
                        const selectedStatusOption = columnMeta.statusOptions?.find(
                            option => option.label === currentStatusText || (currentStatusText === '' && option.id === 'clear')
                        );

                        const backgroundColor = selectedStatusOption?.color || '#c4c4c4';
                        const textColor = (backgroundColor === '#c4c4c4' || backgroundColor === '#e0e0e0') ? '#323338' : '#fff';

                        const dialogContent = (
                            <DialogContentContainer style={{ padding: '8px', minWidth: '150px', backgroundColor: 'white' }}>
                                <Flex direction={Flex.directions.COLUMN} gap={Flex.gaps.SMALL}>
                                    {Array.isArray(columnMeta.statusOptions) && columnMeta.statusOptions.map(option => (
                                        <Button
                                            key={option.id}
                                            kind={Button.kinds.TERTIARY}
                                            onClick={() => handleStatusChange(option, item, columnMeta)}
                                            style={{
                                                justifyContent: 'flex-start',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                width: '100%',
                                                backgroundColor: option.color,
                                                color: (option.color === '#c4c4c4' || option.color === '#e0e0e0') ? '#323338' : '#fff',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                border: 'none',
                                            }}
                                        >
                                            <Text type="text2" color={(option.color === '#c4c4c4' || option.color === '#e0e0e0') ? 'primary' : 'onPrimary'}>
                                                {option.label === '' ? 'No status' : option.label}
                                            </Text>
                                        </Button>
                                    ))}
                                </Flex>
                            </DialogContentContainer>
                        );

                        displayContent = (
                            <Dialog
                                position="bottom"
                                offset={{ y: 20 }}
                                open={cellDialogState.isOpen && !cellDialogState.isHeader && !cellDialogState.isHover && cellDialogState.item?.id === item.id && cellDialogState.column?.id === columnMeta.id}
                                onClose={() => setCellDialogState({ isOpen: false, item: null, column: null, anchorEl: null, isHeader: false, user: null, isHover: false })}
                                content={dialogContent}
                                showTrigger={[]}
                                hideTrigger={['OUTSIDE_CLICK', 'ESCAPE_KEY']}
                                width="small"
                                style={{ zIndex: 999999 }}
                            >
                                <div
                                    onClick={(e) => handleCellDialogClick(e, item, columnMeta)}
                                    className="monday-status-label"
                                    style={{
                                        backgroundColor: backgroundColor,
                                        color: textColor,
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 8px',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Text type="text2" color={(backgroundColor === '#c4c4c4' || backgroundColor === '#e0e0e0') ? 'primary' : 'onPrimary'}>
                                        {(currentStatusText === '' || currentStatusText === '-' || currentStatusText === 'undefined' || currentStatusText === 'null') ? '' : currentStatusText}
                                    </Text>
                                </div>
                            </Dialog>
                        );
                    }
                    else if (columnType === 'date') {
                        let formattedDate = '';
                        if (columnValue && columnValue.text) {
                            const date = new Date(columnValue.text);
                            if (!isNaN(date.getTime())) {
                                formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }
                        }
                        displayContent = (
                            <div className="date-cell-content">
                                <Text type="text2" color="primary">{formattedDate}</Text>
                            </div>
                        );
                    }
                    else if (columnValue && columnValue.value !== null && String(columnValue.value).trim() !== '') {
                        let parsedValue = null;
                        try {
                            parsedValue = JSON.parse(columnValue.value);
                        } catch (e) {
                            // Error parsing column value to JSON, ignore and use text content or default.
                        }

                        switch (columnType) {
                            case 'person':
                            case 'people':
                                let personsInColumn = [];
                                if (parsedValue && parsedValue.personsAndTeams && Array.isArray(parsedValue.personsAndTeams)) {
                                    personsInColumn = parsedValue.personsAndTeams.filter(p => p.kind === 'person');
                                } else if (Array.isArray(parsedValue)) {
                                    personsInColumn = parsedValue.filter(p => p.kind === 'person');
                                }

                                if (personsInColumn.length > 0) {
                                    const getAvatarLabel = (user) => {
                                        const label = user?.name || (user?.id ? `User ID: ${user.id}` : 'Unknown User');
                                        return label;
                                    };

                                    displayContent = (
                                        <Flex align={Flex.align.CENTER} justify={Flex.justify.CENTER} gap={Flex.gaps.XSMALL} style={{ width: '100%' }}>
                                            {personsInColumn.length > 1 ? (
                                                <AvatarGroup size="small" max={3} counterTooltipIsVirtualizedList>
                                                    {personsInColumn.map(personData => {
                                                        const cachedUser = cachedUsers[personData.id];
                                                        const userName = cachedUser?.name || 'Unknown';
                                                        const userPhoto = cachedUser?.photo_original;

                                                        let avatarText = '?';
                                                        if (cachedUser) {
                                                            avatarText = (userName ? userName.substring(0, 2).toUpperCase() : 'NP');
                                                            if (userName === "" && cachedUser.id) avatarText = cachedUser.id.substring(0, 2).toUpperCase();
                                                        }

                                                        return (
                                                            <div
                                                                key={personData.id}
                                                                style={{ display: 'inline-block', position: 'relative' }}
                                                            >
                                                                <Dialog
                                                                    position="bottom"
                                                                    offset={{ y: 20 }}
                                                                    open={cellDialogState.isOpen && cellDialogState.isHover && cellDialogState.user?.id === personData.id}
                                                                    onClose={handleAvatarMouseLeave}
                                                                    content={renderUserDetailsDialogContent(cachedUser || { id: personData.id, name: userName, photo_original: userPhoto })}
                                                                    showTrigger={[]}
                                                                    hideTrigger={['OUTSIDE_CLICK', 'ESCAPE_KEY']}
                                                                    anchorElement={cellDialogState.anchorEl}
                                                                    width="small"
                                                                    style={{ zIndex: 999999 }}
                                                                >
                                                                    <Avatar
                                                                        type={userPhoto ? Avatar.types.IMG : Avatar.types.TEXT}
                                                                        src={userPhoto || undefined}
                                                                        text={avatarText}
                                                                        ariaLabel={getAvatarLabel(cachedUser || { id: personData.id })}
                                                                        onClick={() => redirectToUserProfile(personData.id)}
                                                                        onMouseEnter={(e) => handleAvatarMouseEnter(e, cachedUser || { id: personData.id, name: userName, photo_original: userPhoto })}
                                                                        onMouseLeave={handleAvatarMouseLeave}
                                                                        className="monday-avatar"
                                                                        size="small"
                                                                    />
                                                                </Dialog>
                                                            </div>
                                                        );
                                                    })}
                                                </AvatarGroup>
                                            ) : (
                                                (() => {
                                                    const personData = personsInColumn[0];
                                                    const cachedUser = cachedUsers[personData.id];
                                                    const userName = cachedUser?.name || 'Unknown';
                                                    const userPhoto = cachedUser?.photo_original;

                                                    let avatarText = '?';
                                                    if (cachedUser) {
                                                        avatarText = (userName ? userName.substring(0, 2).toUpperCase() : 'NP');
                                                        if (userName === "" && cachedUser.id) avatarText = cachedUser.id.substring(0, 2).toUpperCase();
                                                    }

                                                    return (
                                                        <Dialog
                                                            position="bottom"
                                                            offset={{ y: 20 }}
                                                            open={cellDialogState.isOpen && cellDialogState.isHover && cellDialogState.user?.id === personData.id}
                                                            onClose={handleAvatarMouseLeave}
                                                            content={renderUserDetailsDialogContent(cachedUser || { id: personData.id, name: userName, photo_original: userPhoto })}
                                                            showTrigger={[]}
                                                            hideTrigger={['OUTSIDE_CLICK', 'ESCAPE_KEY']}
                                                            anchorElement={cellDialogState.anchorEl}
                                                            width="small"
                                                            style={{ zIndex: 999999 }}
                                                        >
                                                            <Avatar
                                                                type={userPhoto ? Avatar.types.IMG : Avatar.types.TEXT}
                                                                src={userPhoto || undefined}
                                                                text={avatarText}
                                                                ariaLabel={getAvatarLabel(cachedUser || { id: personData.id })}
                                                                size="small"
                                                                onClick={() => redirectToUserProfile(personData.id)}
                                                                onMouseEnter={(e) => handleAvatarMouseEnter(e, cachedUser || { id: personData.id, name: userName, photo_original: userPhoto })}
                                                                onMouseLeave={handleAvatarMouseLeave}
                                                                className="monday-avatar"
                                                            />
                                                        </Dialog>
                                                    );
                                                })()
                                            )}
                                        </Flex>
                                    );
                                } else {
                                    displayContent = (
                                        <Text type="text2" color="secondary">
                                            {activeFilters[columnId] && activeFilters[columnId].includes('No user') ? (
                                                'No user'
                                            ) : (
                                                ''
                                            )}
                                        </Text>
                                    );
                                }
                                break;
                            case 'numbers':
                                displayContent = <Text type="text2" color="primary">{columnValue.text || (parsedValue?.number !== undefined && parsedValue?.number !== null ? parsedValue.number.toString() : '')}</Text>;
                                break;
                            case 'link':
                                if (parsedValue && parsedValue.url) {
                                    displayContent = (
                                        <Link
                                            text={parsedValue.text || parsedValue.url}
                                            href={parsedValue.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            color="primary"
                                            iconPosition="end"
                                            inlineText
                                            inheritFontSize
                                        />
                                    );
                                } else {
                                    displayContent = <Text type="text2" color="secondary"></Text>;
                                }
                                break;
                            default:
                                displayContent = <Text type="text2" color="primary">{columnValue.display_value || columnValue.text || ''}</Text>;
                                break;
                        }
                    }

                    return (
                        <TableCell
                            key={columnId}
                            className={cellClassName}
                            style={{
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                boxSizing: 'border-box'
                            }}
                        >
                            {displayContent}
                        </TableCell>
                    );
                })}
            </TableRow>
        );
    }, [columnsForTable, editingItemId, editedItemName, cachedUsers, mondayBaseUrl, handleSaveEdit, handleKeyDown, handleStatusChange, handleCellDialogClick, handleAvatarMouseEnter, handleAvatarMouseLeave, cellDialogState, redirectToUserProfile, renderUserDetailsDialogContent, activeFilters]);

    // uniquePeopleInBoardItems is still defined here for use in renderFilterDialogContent
    const uniquePeopleInBoardItems = useMemo(() => {
        const peopleMap = new Map();
        boardItems.forEach(item => {
            item.column_values.forEach(cv => {
                const columnMeta = allBoardColumns.find(col => col.id === cv.id);
                if (columnMeta && (columnMeta.type === 'person' || columnMeta.type === 'people')) {
                    if (cv.value && String(cv.value).trim() !== '') {
                        try {
                            const parsedValue = JSON.parse(cv.value);
                            let persons = [];
                            if (parsedValue && parsedValue.personsAndTeams && Array.isArray(parsedValue.personsAndTeams)) {
                                persons = parsedValue.personsAndTeams.filter(p => p.kind === 'person');
                            } else if (Array.isArray(parsedValue)) {
                                persons = parsedValue.filter(p => p.kind === 'person');
                            }
                            persons.forEach(p => {
                                if (p.id) {
                                    const cachedUser = cachedUsers[p.id];
                                    if (cachedUser) {
                                        peopleMap.set(cachedUser.id, cachedUser);
                                    } else {
                                        peopleMap.set(p.id, { id: p.id, name: 'Unknown User', photo_original: null });
                                    }
                                }
                            });
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            });
        });
        return Array.from(peopleMap.values());
    }, [boardItems, allBoardColumns, cachedUsers]);


    const renderFilterDialogContent = useCallback((columnMeta) => {
        const currentSelectedFilters = activeFilters[columnMeta.id] || [];
        const isFilterActiveForColumn = currentSelectedFilters.length > 0;

        const handleCheckboxChangeInternal = (value, isChecked) => {
            handleFilterChange(columnMeta.id, value, isChecked);
        };

        const renderFilterOptions = () => {
            switch (columnMeta.type) {
                case 'status':
                    return (
                        <>
                            <Heading type="h4" style={{ marginBottom: '8px' }}>Filter by Status</Heading>
                            {Array.isArray(columnMeta.statusOptions) && columnMeta.statusOptions.map(option => {
                                const filterValue = option.label === '' ? 'No status' : option.label;
                                const isChecked = currentSelectedFilters.includes(filterValue);
                                const backgroundColor = option.color;
                                const textColor = (backgroundColor === '#c4c4c4' || backgroundColor === '#e0e0e0') ? '#323338' : '#fff';

                                return (
                                    <Flex
                                        key={option.id}
                                        align={Flex.align.CENTER}
                                        gap={Flex.gaps.XSMALL}
                                        style={{ cursor: 'pointer', padding: '4px 0' }}
                                        onClick={() => handleCheckboxChangeInternal(filterValue, !isChecked)}
                                    >
                                        <Checkbox checked={isChecked} onChange={(e) => handleCheckboxChangeInternal(filterValue, e.target.checked)} />
                                        <div
                                            style={{
                                                backgroundColor: backgroundColor,
                                                color: textColor,
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                minWidth: '80px',
                                                textAlign: 'center',
                                            }}
                                        >
                                            <Text type="text2" color={(backgroundColor === '#c4c4c4' || backgroundColor === '#e0e0e0') ? 'primary' : 'onPrimary'}>
                                                {option.label === '' ? 'No status' : option.label}
                                            </Text>
                                        </div>
                                    </Flex>
                                );
                            })}
                        </>
                    );
                case 'person':
                case 'people':
                    return (
                        <>
                            <Heading type="h4" style={{ marginBottom: '8px' }}>Filter by User</Heading>
                            {currentUserId && (
                                <Flex
                                    align={Flex.align.CENTER}
                                    gap={Flex.gaps.XSMALL}
                                    style={{ cursor: 'pointer', padding: '4px 0' }}
                                    onClick={() => handleCheckboxChangeInternal(String(currentUserId), !currentSelectedFilters.includes(String(currentUserId)))}
                                >
                                    <Checkbox checked={currentSelectedFilters.includes(String(currentUserId))} onChange={(e) => handleCheckboxChangeInternal(String(currentUserId), e.target.checked)} />
                                    <Avatar
                                        type={Avatar.types.TEXT}
                                        text="Me"
                                        size="small"
                                        ariaLabel="My Tasks"
                                        style={{backgroundColor: 'var(--monday-color-primary)'}}
                                    />
                                    <Text type="text2" color="primary">My Tasks</Text>
                                </Flex>
                            )}
                            <Flex
                                align={Flex.align.CENTER}
                                gap={Flex.gaps.XSMALL}
                                style={{ cursor: 'pointer', padding: '4px 0' }}
                                onClick={() => handleCheckboxChangeInternal('No user', !currentSelectedFilters.includes('No user'))}
                            >
                                <Checkbox checked={currentSelectedFilters.includes('No user')} onChange={(e) => handleCheckboxChangeInternal('No user', e.target.checked)} />
                                <Avatar
                                    type={Avatar.types.TEXT}
                                    text="?"
                                    size="small"
                                    ariaLabel="No user"
                                    style={{backgroundColor: '#c4c4c4'}}
                                />
                                <Text type="text2" color="primary">No user</Text>
                            </Flex>

                            <Divider style={{ margin: '8px 0' }} />
                            {uniquePeopleInBoardItems.length > 0 ? (
                                uniquePeopleInBoardItems.map(user => {
                                    const isChecked = currentSelectedFilters.includes(String(user.id));
                                    return (
                                        <Flex
                                            key={user.id}
                                            align={Flex.align.CENTER}
                                            gap={Flex.gaps.XSMALL}
                                            style={{ cursor: 'pointer', padding: '4px 0' }}
                                            onClick={() => handleCheckboxChangeInternal(String(user.id), !isChecked)}
                                        >
                                            <Checkbox checked={isChecked} onChange={(e) => handleCheckboxChangeInternal(String(user.id), e.target.checked)} />
                                            <Avatar
                                                type={user.photo_original ? Avatar.types.IMG : Avatar.types.TEXT}
                                                src={user.photo_original || undefined}
                                                text={user.name ? user.name.substring(0, 2).toUpperCase() : 'NP'}
                                                size="small"
                                                ariaLabel={user.name || 'User Avatar'}
                                            />
                                            <Text type="text2" color="primary">{user.name || 'Unknown User'}</Text>
                                        </Flex>
                                    );
                                })
                            ) : (
                                <Text type="text2" color="secondary">No users found in this column.</Text>
                            )}
                        </>
                    );
                default:
                    return <Text type="text2" color="secondary">No filter options for this column type.</Text>;
            }
        };

        return (
            <DialogContentContainer style={{ padding: '8px', minWidth: '200px', backgroundColor: 'white' }}>
                <Flex direction={Flex.directions.COLUMN} gap={Flex.gaps.XSMALL}>
                    {renderFilterOptions()}
                    {isFilterActiveForColumn && (
                        <>
                            <Divider style={{ margin: '8px 0' }} />
                            <Button
                                kind={Button.kinds.TERTIARY}
                                onClick={() => handleClearFilter(columnMeta.id)}
                                size="small"
                                style={{ justifyContent: 'center' }}
                            >
                                Clear Filter
                            </Button>
                        </>
                    )}
                </Flex>
            </DialogContentContainer>
        );
    }, [activeFilters, handleFilterChange, handleClearFilter, uniquePeopleInBoardItems, currentUserId, cachedUsers]);


    const HeaderRenderer = useCallback((columns) => {
        const [openFilterDialogId, setOpenFilterDialogId] = useState(null);

        const handleFilterButtonClick = useCallback((event, columnId) => {
            setOpenFilterDialogId(prevId => (prevId === columnId ? null : columnId));
        }, []);

        const handleFilterDialogClose = useCallback(() => {
            setOpenFilterDialogId(null);
        }, []);

        return (
            <TableHeader>
                {columns.map((headerCell) => {
                    const isFilterable = ['status', 'person', 'people'].includes(headerCell.type);
                    const hasActiveFilter = (activeFilters[headerCell.id] && activeFilters[headerCell.id].length > 0) ||
                                            (headerCell.id === 'current_user_filter' && activeFilters['current_user_filter'] && activeFilters['current_user_filter'].includes('true'));

                    let headerTitleContent = (
                        <Flex align={Flex.align.CENTER} justify={Flex.justify.CENTER} gap={Flex.gaps.XSMALL} style={{ width: '100%' }}>
                            <Text type="text2" weight="bold" color="primary">{headerCell.title}</Text>
                            {isFilterable && (
                                <Dialog
                                    position="bottom"
                                    offset={{ y: 10 }}
                                    open={openFilterDialogId === headerCell.id}
                                    onClose={handleFilterDialogClose}
                                    content={renderFilterDialogContent(headerCell)}
                                    showTrigger={[]}
                                    hideTrigger={['OUTSIDE_CLICK', 'ESCAPE_KEY']}
                                    width="small"
                                >
                                    <Button
                                        kind={Button.kinds.TERTIARY}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleFilterButtonClick(e, headerCell.id);
                                        }}
                                        className={`filter-button ${hasActiveFilter ? 'filter-active' : ''}`}
                                        style={{ minWidth: 'auto', padding: '4px', marginLeft: '4px' }}
                                    >
                                        <Icon icon={Filter} iconLabel="Filter" size={16} />
                                    </Button>
                                </Dialog>
                            )}
                        </Flex>
                    );

                    return (
                        <TableHeaderCell
                            key={headerCell.id}
                            title={headerTitleContent}
                            className={`TableHeader monday-table-header-cell monday-cell-border`}
                            onSortClicked={sortState => onSort(headerCell.id, sortState)}
                            sortState={sorting[headerCell.id]}
                        />
                    );
                })}
            </TableHeader>
        );
    }, [onSort, sorting, activeFilters, handleFilterChange, handleClearFilter, uniquePeopleInBoardItems, currentUserId, cachedUsers, renderFilterDialogContent]);

    return (
        <div className="monday-table-container">
            <Flex justify={Flex.justify.END} style={{ marginBottom: '16px', paddingRight: '8px' }}>
                <Button
                    onClick={() => handleFilterChange('current_user_filter', 'true', !activeFilters['current_user_filter']?.includes('true'))}
                    kind={activeFilters['current_user_filter']?.includes('true') ? Button.kinds.PRIMARY : Button.kinds.SECONDARY}
                    size="small"
                    leftIcon={currentUserId && (
                        <Avatar
                            type={cachedUsers[currentUserId]?.photo_original ? Avatar.types.IMG : Avatar.types.TEXT}
                            src={cachedUsers[currentUserId]?.photo_original || undefined}
                            text={cachedUsers[currentUserId]?.name ? cachedUsers[currentUserId].name.substring(0, 2).toUpperCase() : 'ME'}
                            size="small"
                        />
                    )}
                >
                    My Tasks
                </Button>
            </Flex>

            {(boardItems && boardItems.length > 0) ? (
                <Table
                    columns={columnsForTable}
                    className="monday-table"
                    size="large"
                >
                    {HeaderRenderer(columnsForTable)}
                    <TableBody>
                        {filteredAndSortedBoardItems.map(item => RowRenderer(item))}
                    </TableBody>
                </Table>
            ) : (
                <EmptyState title="No data to display" description="Check the selected boards and fields in the sidebar." size="large" />
            )}
        </div>
    );
}

export default TaskTable;