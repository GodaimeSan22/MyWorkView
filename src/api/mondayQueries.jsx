// src/api/mondayQueries.js

/**
 * GraphQL query to fetch all boards.
 * Returns board IDs and names.
 */
export const GET_BOARDS_QUERY = `
  query {
    boards {
      id
      name
    }
  }
`;

/**
 * GraphQL query to fetch columns for all boards, including column settings.
 * The 'settings_str' field is crucial for parsing status column labels and colors.
 * Returns board IDs, names, and for each board, column IDs, titles, types, and settings.
 */
export const GET_BOARD_COLUMNS_QUERY = `
  query {
    boards {
      id
      name
      columns {
        id
        title
        type
        settings_str
      }
    }
  }
`;

/**
 * GraphQL query to fetch items for a specific board with values for selected columns.
 * Includes a limit to prevent excessively large responses.
 *
 * @param {string} boardId - The ID of the board to query.
 * @param {string[]} columnIds - An array of column IDs to fetch values for.
 * @returns {string} The GraphQL query string.
 */
export const GET_BOARD_ITEMS_WITH_COLUMNS_QUERY = (boardId, columnIds) => {
  return `
    query {
      boards(ids: [${boardId}]) {
        id
        name
        items_page(limit: 500) {
          items {
            id
            name
            board {
              id
              name
            }
            group {
              id
              title
            }
            column_values(ids: [${columnIds.map(id => `"${id}"`).join(',')}]) {
              id
              text
              value
              # Removed display_value as it caused an API error
            }
          }
        }
      }
    }
  `;
};

/**
 * GraphQL mutation to update an item's name using the change_column_value mutation.
 * The 'name' column, being a text field, expects a JSON string value like '{"text": "Your New Name"}'.
 *
 * @param {string} boardId - The ID of the board.
 * @param {string} itemId - The ID of the item to update.
 * @param {string} newName - The new name for the item.
 * @returns {string} The GraphQL mutation string.
 */
export const UPDATE_ITEM_NAME_QUERY = (boardId, itemId, newName) => {
  const valuePayload = JSON.stringify(newName);

  return `
    mutation {
      change_column_value(
        board_id: ${boardId},
        item_id: ${itemId},
        column_id: "name",
        value: ${JSON.stringify(valuePayload)}
      ) {
        id
        name
        column_values {
          id
          text
        }
      }
    }
  `;
};

/**
 * GraphQL mutation to update the value of any column for an item.
 * The `valuePayloadString` parameter is expected to be a JSON string
 * that Monday.com's API expects for the specific column type.
 * For example, for a 'status' column, it should be `JSON.stringify({ label: "New Status" })`.
 * For simple 'text' or 'numbers' columns, it might be `JSON.stringify("Some Text")` or `JSON.stringify("123")`.
 *
 * @param {string} boardId - The ID of the board.
 * @param {string} itemId - The ID of the item to update.
 * @param {string} columnId - The ID of the column to update.
 * @param {string} valuePayloadString - The stringified JSON payload representing the new column value.
 * E.g., `JSON.stringify({ label: "Done" })` for status.
 * @returns {string} The GraphQL mutation string.
 */
export const UPDATE_COLUMN_VALUE_QUERY = (boardId, itemId, columnId, valuePayloadString) => {
  return `
    mutation {
      change_column_value(
        board_id: ${boardId},
        item_id: ${itemId},
        column_id: "${columnId}",
        value: ${JSON.stringify(valuePayloadString)}
      ) {
        id
        name
        column_values {
          id
          text
          value
        }
      }
    }
  `;
};

/**
 * GraphQL query to fetch details of a specific user by ID.
 * Returns user ID, name, original photo URL, and email.
 *
 * @param {string} userId - The ID of the user to query.
 * @returns {string} The GraphQL query string.
 */
export const GET_USER_DETAILS_QUERY = (userId) => `
  query {
    users(ids: [${userId}]) {
      id
      name
      photo_original
      email
    }
  }
`;