# New Tab Organizer

A cleaner new tab page for Brave and Chrome focused on bookmark organization.

## Why

The default new tab is fine, but not great for people who actually use bookmarks every day. This extension turns it into a simple dashboard with folders, search, pinned links, and quick organization tools.

## Features

- Folder-based bookmark navigation
- Fast bookmark search
- Pinned bookmarks
- Create, edit, move, and delete bookmarks and folders
- Drag & drop organization
- Weather widget
- Monthly calendar
- Built-in wallpapers and custom background
- Persistent preferences

## Tech

- React
- TypeScript
- Vite
- Chrome Extension Manifest V3

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/`

## Install in Brave or Chrome

1. Run `npm run build`
2. Open `brave://extensions` or `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist/` folder
