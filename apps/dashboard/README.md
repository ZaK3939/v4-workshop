# Uniswap V4 Analytics Dashboard

A modern React-based analytics dashboard for Uniswap V4, built with Next.js and TypeScript. This application provides real-time insights into Uniswap V4's performance, focusing on hook analytics and pool monitoring on Unichain.

## Features

- **Unichain Support**: Track Uniswap V4 metrics on Unichain network with:
  - Real-time hook analytics
  - Pool monitoring
  - Transaction tracking
  - Event indexing via Envio

- **Real-time Analytics**: Live tracking of:
  - Swap volumes and counts
  - Total Value Locked (TVL)
  - Pool statistics
  - Hook usage and performance
  - Transaction counts

- **Interactive UI Components**:
  - Animated data visualizations
  - Network-specific metrics
  - Detailed pool information
  - Hook analytics and information
  - API documentation

## Tech Stack

- **Frontend Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Data Fetching**: GraphQL
- **Animations**: Framer Motion
- **UI Components**: Custom components with Lucide icons
- **Theme Support**: Dark/Light mode via next-themes

## Project Structure

```
.
├── apps/
│   └── web/                 # Main Next.js application
│       ├── app/            # Next.js app directory
│       ├── components/     # React components
│       ├── hooks/         # Custom React hooks
│       └── lib/           # Utilities and configurations
├── packages/              # Shared packages
└── pnpm-workspace.yaml   # Workspace configuration
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Build for production:
   ```bash
   pnpm build
   ```

## Development

The application uses a monorepo structure with pnpm workspaces. The main application is located in the `apps/web` directory.

### Key Components

- **Stats Dashboard**: Real-time statistics for Unichain network
- **Pulse Analytics**: Live tracking of swaps and pool activities
- **TVL Tracking**: Total Value Locked metrics and trends
- **Pool Analytics**: Detailed information about Uniswap V4 pools
- **Hook Information**: Comprehensive data about Uniswap V4 hooks
- **API Documentation**: Information about available APIs and endpoints

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Workshop Integration

This dashboard is part of the EDCON 2025 Uniswap V4 workshop. It connects to the Envio indexer to display real-time data from deployed hooks and pools on Unichain.

### Prerequisites

- Envio indexer running on http://localhost:8080
- Deployed V4 hooks and pools on Unichain
- Node.js 18+ and pnpm installed