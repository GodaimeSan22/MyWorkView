// Sidebar.jsx
import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { Checkbox, Button } from '@vibe/core'; 

const monday = mondaySdk();

function Sidebar({
  onBoardToggle,
  selectedBoardIds,
  allBoardColumns,
  selectedColumnIds,
  onColumnToggle,
  onSelectAllColumns,
  onDeselectAllColumns,
  sidebarWidth 
}) {
  const [allAccessibleBoards, setAllAccessibleBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [boardsError, setBoardsError] = useState(null);

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        setLoadingBoards(true);
        setBoardsError(null);
        const response = await monday.api(`query { boards { id name } }`);
        if (response && response.data && response.data.boards) {
          setAllAccessibleBoards(response.data.boards);
        } else {
          setAllAccessibleBoards([]);
          console.warn("Sidebar: No boards found or unexpected response structure.", response);
        }
      } catch (err) {
        console.error("Sidebar: Error fetching all accessible boards:", err);
        setBoardsError("Failed to load the list of boards.");
      } finally {
        setLoadingBoards(false);
      }
    };
    fetchBoards();
  }, []);

  return (
    <div style={{
      width: sidebarWidth, 

      maxWidth: '100%', 
      borderRight: '1px solid #ddd',
      backgroundColor: '#f9f9f9',
      overflowY: 'auto',
      transition: 'width 0.3s ease-in-out',
      boxSizing: 'border-box'
    }}>
      <div style={{ padding: '20px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Settings</h2>

        {/* Boards Selection */}
        <h3 style={{ marginTop: '20px', marginBottom: '10px', color: '#555' }}>Select Boards</h3>
        <div style={{ marginBottom: '10px' }}>
        </div>
        {loadingBoards ? (
          <p>Loading boards...</p>
        ) : boardsError ? (
          <p style={{ color: 'red' }}>{boardsError}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {allAccessibleBoards.map(board => (
              <li key={board.id} style={{ marginBottom: '8px' }}>
                <Checkbox
                  checked={selectedBoardIds.includes(board.id)}
                  onChange={() => onBoardToggle(board.id)}
                  label={board.name}

                  labelStyle={{ wordBreak: 'break-word' }} 
                />
              </li>
            ))}
          </ul>
        )}

        {/* Columns Selection */}
        <h3 style={{ marginTop: '30px', marginBottom: '10px', color: '#555' }}>Select Fields</h3>
        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
          <Button
            onClick={onSelectAllColumns}
            kind="primary"
            size="medium"
          >
            Select All Fields
          </Button>
          <Button
            onClick={onDeselectAllColumns}
            kind="primary"
            size="medium"
          >
            Deselect All Fields
          </Button>
        </div>
        {allBoardColumns.length === 0 && selectedBoardIds.length > 0 && (
            <p style={{ color: '#777' }}>Loading fields...</p>
        )}
        {selectedBoardIds.length === 0 ? (
          <p style={{ color: '#777' }}>Select boards to see available fields.</p>
        ) : allBoardColumns.length === 0 ? (
          <p style={{ color: '#777' }}>No fields to display in the selected boards.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {allBoardColumns.map(column => (
              <li key={column.id} style={{ marginBottom: '8px' }}>
                <Checkbox
                  checked={selectedColumnIds.includes(column.id)}
                  onChange={() => onColumnToggle(column.id)}
                  label={column.title}

                  labelStyle={{ wordBreak: 'break-word' }} 
                />
              </li>
            ))}
          </ul>
        )}
      </div> 
    </div>
  );
}

export default Sidebar;