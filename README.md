# 🚀 Monday.com Enhanced Board Data Viewer 🚀

[![Made with React](https://img.shields.io/badge/Made%20with-React-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Monday.com App](https://img.shields.io/badge/Monday.com-App-0073ea?style=for-the-badge&logo=monday.com&logoColor=white)](https://monday.com/developers/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 🌟 Overview

The **Monday.com Enhanced Board Data Viewer** is a powerful custom application designed to revolutionize how you interact with your Monday.com board data. Say goodbye to scattered information and hello to a unified, dynamic, and highly interactive view of your projects!

Built seamlessly into the Monday.com platform, this app allows you to aggregate, filter, and even *edit* data from multiple boards in one central, intuitive table. Whether you're a project manager, a team lead, or just someone who needs a clearer overview, this app is engineered to streamline your workflow and enhance your decision-making.

## ✨ Key Features

This application isn't just a viewer; it's a dynamic data hub packed with capabilities:

* **📊 Multi-Board Data Aggregation**: Consolidate items and columns from as many Monday.com boards as you need into a single, cohesive table. Get a holistic view across departments or projects.
* **⚙️ Dynamic Column Selection**: Take full control! Easily choose which specific columns from your selected boards you want to display in the main data table via a smart, customizable sidebar.
* **💾 Persistent User Settings**: Your preferences matter. The app intelligently saves your selected boards, columns, and sidebar visibility to Monday.com's app storage, ensuring your personalized setup is instantly loaded every time.
* **🔄 Real-time Data Refresh**: Stay up-to-date effortlessly. The application periodically fetches the latest data from your Monday.com boards, so your view is always current.
* **✏️ Inline Editing**: Boost your productivity! Directly edit item names and various column values (like status, text, numbers, etc.) right within the table interface.
* **👤 "My Tasks" Quick Filter**: Instantly filter the table to show only items assigned to *you*, helping you focus on your personal workload.
* **🛡️ Robust API Handling**: Experience reliable performance. The `useMondayAPI` hook includes sophisticated error handling with an exponential backoff retry mechanism, gracefully managing Monday.com API rate limits and concurrency issues.
* **🧭 Intuitive Sidebar**: A dedicated, responsive sidebar offers a smooth experience for configuring visible boards and columns, including convenient "Select All" / "Deselect All" options.
* **🎨 Native Monday.com UI**: Leveraging `@vibe/core` components, the app blends seamlessly with the Monday.com ecosystem, offering a familiar and polished user interface.

## 🛠️ Technologies Used

This project is built with modern web technologies, ensuring high performance, maintainability, and a delightful developer experience:

* **[React](https://react.dev/)**: The powerful JavaScript library for building dynamic and interactive user interfaces.
* **[Vite](https://vitejs.dev/)**: A blazing-fast build tool that significantly improves development speed with its instant server start and hot module replacement.
* **[monday-sdk-js](https://monday.com/developers/apps/sdk/js)**: The official Monday.com JavaScript SDK, providing seamless interaction with the Monday.com API and platform features like app storage.
* **[GraphQL](https://graphql.org/)**: The query language used for efficient and flexible data fetching and manipulation with the Monday.com API.
* **[@vibe/core](https://monday.com/developers/apps/sdk/vibe-react)**: Monday.com's own React UI component library, providing pre-built components (Table, Button, Checkbox, Avatar, Dialog, etc.) for building native-looking apps.
* **CSS**: Styled with plain CSS, leveraging Monday.com's design variables for consistent theming and component appearance.

## 🚀 Installation and Local Development

Get this project up and running on your local machine in just a few steps:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/GodaimeSan22/MyWorkView.git](https://github.com/GodaimeSan22/MyWorkView.git)
    cd MyWorkView
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    # or yarn install
    ```

3.  **Set up Environment Variables (Optional but Recommended):**
    Create a `.env` file in the root of your project. While many Monday.com app views can run locally without explicit keys if configured correctly in the Dev Center's "Development URL," this file is crucial for sensitive data like API keys or secrets for server-side components, if your app were to expand.

    Example `.env` (adjust if your app specifically requires these for local dev):
    ```dotenv
    # VITE_APP_MONDAY_CLIENT_ID=your_monday_client_id_here
    # VITE_APP_MONDAY_SIGNING_SECRET=your_monday_signing_secret_here
    # Add any other environment variables your app might consume (e.g., VITE_API_URL)
    ```

4.  **Start the Development Server:**
    ```bash
    npm run dev
    # or yarn dev
    ```
    Your application will typically launch at `http://localhost:3000`. Keep this URL handy for Monday.com app configuration.

## ⚙️ Monday.com App Configuration

To bring your powerful app to life within your Monday.com workspace, you need to register it in the Monday.com Developer Center:

1.  **Access the Developer Center**: Navigate to `https://monday.com/app/developer/apps`.
2.  **Create a New App**: Click the `Create new app` button.
3.  **Configure App Details**:
    * **App Name & Description**: Give your app a catchy name and a clear description.
    * **Features**: Select the relevant feature for your app (e.g., `App View` to embed it in a board, or `Dashboard Widget`).
    * **Development URL**: For local development, set this URL to where your local server is running (e.g., `http://localhost:3000`). This tells Monday.com where to load your app from.
    * **Production URL**: When you're ready to deploy, you'll update this with the publicly accessible URL of your hosted build.
    * **API Scopes**: This is critical! Grant your app the necessary permissions to interact with your Monday.com data. Based on the app's functionality, you'll need at least:
        * `boards:read` (to fetch boards, columns, items)
        * `boards:write` (to update item names and column values)
        * `users:read` (to fetch user details for filters like "My Tasks")
        * `account:read` (to get the current user's ID)
        * `storage:read` and `storage:write` (to persist app settings)
    * **Save Changes**: Don't forget to save your app configuration!

After these steps, you can add your development app to any Monday.com board or dashboard and start exploring its capabilities!

## 📂 Project Structure

The project adheres to a clean and intuitive React application structure, making it easy to navigate and understand:

.
├── public/                 # 🌐 Static assets: favicon, logos, manifest, robots.txt.
├── src/                    # 🚀 Core application source code.
│   ├── api/                # 📡 Monday.com API interactions:
│   │   └── mondayQueries.jsx   # Defines all GraphQL queries (GET_BOARDS, GET_COLUMNS, GET_ITEMS, GET_USER_DETAILS) and mutations (UPDATE_ITEM_NAME, UPDATE_COLUMN_VALUE).
│   ├── components/         # 🧩 Reusable React UI components:
│   │   ├── Sidebar/        # Component for dynamic board and column selection, and "My Tasks" filter.
│   │   └── TaskTable/      # Main data table component with inline editing and advanced rendering.
│   │       ├── TaskTable.css # Dedicated styling for the TaskTable.
│   │       └── TaskTable.jsx # Logic and rendering for the TaskTable component.
│   │   ├── ErrorMessage.jsx    # (Placeholder) Component for displaying user-friendly error messages.
│   │   └── LoadingSpinner.jsx  # (Placeholder) Component for indicating data loading states.
│   ├── hooks/              # 🎣 Custom React Hooks for Monday.com specific logic:
│   │   └── useMondayAPI.jsx    # Custom hook for all Monday.com API calls, including built-in retry logic.
│   ├── App.css             # 💅 Global CSS styles for the application, leveraging Monday.com design variables.
│   ├── App.jsx             # 🖥️ The main application component, orchestrating state management, data fetching, and overall layout.
│   ├── index.css           # 🎨 Entry point CSS for global styles.
│   ├── index.jsx           # ⚡ React application's entry point, rendering the App component.
│   ├── init.js             # 📦 Initializes the Monday.com SDK instance globally for app-wide use.
│   └── serviceWorker.js    # ⚙️ Registers a service worker for Progressive Web App (PWA) features (offline support, caching).
├── .env                    # 🔒 Environment variables (ignored by Git for security).
├── .gitignore              # 🚫 Specifies intentionally untracked files and directories (like node_modules, build artifacts).
├── index.html              # 📄 The main HTML file that serves your React application.
├── package.json            # 📋 Project metadata, npm scripts, and a list of all project dependencies.
├── package-lock.json       # 🔒 Records the exact versions of all dependencies for consistent builds.
├── README.md               # 📖 This comprehensive documentation file!
└── vite.config.js          # ⚙️ Vite build tool configuration file.


## 🌐 Monday.com API Interaction

The application communicates efficiently with the Monday.com platform using the `monday-sdk-js` library and GraphQL.

* **SDK Initialization (`init.js`)**: A single, global `mondaySdk` instance is set up to provide consistent access to the Monday.com platform features throughout the app.
* **Smart API Hook (`useMondayAPI.jsx`)**: All GraphQL interactions are channeled through the `useMondayAPI` custom hook. This hook is a powerhouse, providing:
    * **Centralized Query Execution**: A clean interface for executing any GraphQL query or mutation.
    * **Robust Error Handling**: Catches and processes API errors gracefully.
    * **Intelligent Retry Logic**: Implements an exponential backoff strategy with a `retry` function to automatically re-attempt API calls that fail due to rate limits or concurrency issues, ensuring maximum reliability.
* **Comprehensive GraphQL Operations (`mondayQueries.jsx`)**: This file serves as the central hub for all Monday.com GraphQL operations:
    * **`GET_BOARDS_QUERY`**: Fetches a list of all accessible boards.
    * **`GET_BOARD_COLUMNS_QUERY`**: Retrieves detailed column definitions for selected boards, including `settings_str` crucial for parsing complex column types like Status.
    * **`GET_BOARD_ITEMS_WITH_COLUMNS_QUERY`**: Efficiently fetches items (rows) and their specific column values for selected boards.
    * **`GET_USER_DETAILS_QUERY`**: Used to retrieve user information (e.g., name, photo) for features like the "My Tasks" filter.
    * **`UPDATE_ITEM_NAME_QUERY`**: GraphQL mutation for modifying an item's name directly from the table.
    * **`UPDATE_COLUMN_VALUE_QUERY`**: GraphQL mutation for updating values of various column types, enabling inline editing.
* **Persistent Storage**: The `monday.storage.instance` API is directly utilized in `App.jsx` to effortlessly persist user preferences (selected boards, columns, sidebar visibility) across sessions, remembering your exact setup.

## 🚀 How to Use

Once your app is configured and added to your Monday.com workspace, unleash its power with these simple steps:

1.  **Access the App**: Navigate to the Monday.com board or dashboard where you've added the Enhanced Board Data Viewer.
2.  **Toggle Sidebar**: If the sidebar isn't visible, use the toggle button in the main app view to open it.
3.  **Select Your Boards**: In the sidebar, select one or more Monday.com boards from which you want to aggregate data. Use "Select All Boards" or "Deselect All Boards" for convenience.
4.  **Choose Your Fields (Columns)**: After selecting boards, a list of available columns from those boards will appear. Select the specific fields you want to see in your unified table.
5.  **View Your Unified Data**: The main app area will automatically populate with items from your chosen boards, displaying only the columns you've selected.
6.  **Filter "My Tasks"**: Click the "My Tasks" button at the top of the table to quickly filter items assigned to your Monday.com user.
7.  **Inline Edit**: Simply click on an item's name or any editable column cell (e.g., Text, Numbers, Status) within the table. Make your changes and press Enter (or click away) to save!
8.  **Enjoy Persistence**: All your board and column selections, along with the sidebar's visibility, are automatically saved and will be loaded for you the next time you use the app.

## 🤝 Contributing

We welcome contributions! If you have ideas for improvements, new features, or bug fixes, please don't hesitate to contribute.

1.  **Fork the repository** on GitHub: `https://github.com/GodaimeSan22/MyWorkView.git`
2.  **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name`
3.  **Make your changes**, ensuring all code adheres to the existing style and best practices.
4.  **Commit your changes** with a clear and concise message: `git commit -m 'feat: Briefly describe your new feature'`
5.  **Push your branch** to your forked repository: `git push origin feature/your-feature-name`
6.  **Open a Pull Request** against the `main` branch of this repository.

Your contributions help make this app even better!

## 📜 License

This project is open-source and licensed under the **MIT License**. This means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided you include the original copyright notice and this permission notice.

---