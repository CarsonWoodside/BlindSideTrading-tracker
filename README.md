# BlindSide Card Tracker

A modern, responsive web application for Blindside card collectors to track their collections, monitor set completion, and manage duplicates. Built with React and Vite, it features a clean UI with dark mode support and local persistence.

## 🚀 Features

- **Collection Tracking**: Manage your inventory across multiple teams and seasons.
- **Set Breakdown**: View detailed statistics for each set, including owned counts, missing cards, and completion percentages.
- **Advanced Filtering**: Filter cards by ownership status (Owned, Missing, Duplicates), card type, and rarity.
- **Dynamic Search**: Find specific players or card numbers instantly with the integrated search bar.
- **Dual View Modes**: Switch between a visual **Grid View** (card artwork focused) and a detailed **List View** for bulk management.
- **Dark Mode**: High-contrast dark theme for better visibility in different lighting conditions.
- **Local Storage**: Automatically saves your collection progress to your browser, with built-in storage warnings to prevent data loss.
- **Data Portability**: Built-in functionality to **Export** and **Import** (Replace or Merge) your collection data as JSON files.
- **Mobile Optimized**: Responsive design including a mobile-friendly navigation drawer for on-the-go tracking.

## 🛠 Project Structure

- `App.jsx`: Core application logic, routing, and state management.
- `App.css`: Component-level styling, layout shells, and responsive media queries.
- `index.css`: Global design tokens, theme variables (light/dark), and base resets.
- `lib/catalog.js`: Contains the static data for teams, seasons, and card lists.
- `lib/collectionStore.js`: Utility for handling local storage persistence.

## 💻 Tech Stack

- **Framework**: [React](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Modern CSS with Custom Properties (Variables)
- **Typography**: Space Grotesk (headings) and IBM Plex Mono (monospaced data).

