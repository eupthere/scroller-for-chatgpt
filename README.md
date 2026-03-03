
https://github.com/user-attachments/assets/2a908f9b-949b-461c-b88f-cd44d18b098b


# Scroller for ChatGPT

A browser extension that adds a compact timeline navigator to [chatgpt.com](https://chatgpt.com), making long conversations easier to scan and jump through.

## Features

- Adds a floating timeline of dots next to the ChatGPT thread.
- Uses shape + color to distinguish turns:
  - Rounded square: user message
  - Circle: assistant message
  - Green dot: currently active message
- Click any dot to jump directly to that turn.
- Keyboard navigation:
  - `j` or `ArrowDown`: next turn
  - `k` or `ArrowUp`: previous turn
- Automatically tracks new messages and layout changes.

## Tech Stack

- [WXT](https://wxt.dev/) for extension tooling
- React + TypeScript for UI logic
- Tailwind CSS for styling
- Storybook for component previews

## Project Structure

- `src/entrypoints/chatgpt.content/index.tsx`: content script entrypoint for `*://chatgpt.com/*`
- `src/components/ScrollerApp.tsx`: DOM observation, scroll sync, keyboard controls
- `src/components/Timeline.tsx`: floating timeline container and positioning logic
- `src/components/TimelineDot.tsx`: turn dot rendering and role styling
- `wxt.config.ts`: extension and Vite/WXT configuration

## Prerequisites

- Node.js 18+
- pnpm

## Install

```bash
pnpm install
```

## Development

Run the extension in development mode:

```bash
pnpm dev
```

Firefox development mode:

```bash
pnpm dev:firefox
```

WXT will build and watch changes while providing instructions to load the extension in your browser.

## Build

Build production extension bundles:

```bash
pnpm build
```

Firefox build:

```bash
pnpm build:firefox
```

Create distributable zip packages:

```bash
pnpm zip
pnpm zip:firefox
```

## Storybook

Start Storybook:

```bash
pnpm storybook
```

Build static Storybook:

```bash
pnpm build-storybook
```

## Type Checking

```bash
pnpm compile
```

## Notes

- The extension currently targets `chatgpt.com` pages.
- UI placement is dynamic and follows the conversation thread position.
- Scroll behavior is designed for ChatGPT's nested scroll containers.

## License

MIT
