# RedBook (Little Red Book) Clone

A high-fidelity clone of the popular social commerce app "XiaoHongShu" (Little Red Book), built with React and TypeScript.

## Features

- **Home Feed:** Discovery, Follow, and Nearby tabs with masonry layout.
- **Market (Shop):** E-commerce interface with banners, categories, and product waterfall.
- **Publish:** Create notes with images, titles, content, tags, and location.
- **Messages:** Chat interface, notification groups (Likes, Follows, Comments).
- **Me (Profile):** distinct profile page with sticky header, cover image, user stats, and works/likes/collects tabs.
- **Settings:** Profile editing and app settings.

## Architecture

- **Frontend:** React + TypeScript + Tailwind CSS (styled via standard CSS classes or inline styles in this setup).
- **State Management:** `RedBookContext` provides global state for user, feed, and chats.
- **Routing:** `react-router-dom` with a persistent layout pattern for main tabs (preserving scroll position).
- **Assets:** Sourced from `HongShu-Ui-main` project.

## Credits

UI design and assets referenced from [HongShu-Ui](https://github.com/your-reference-repo).
