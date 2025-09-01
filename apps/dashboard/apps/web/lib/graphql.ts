import { GraphQLClient } from "graphql-request";

// Use API route to avoid CORS issues
export const graphqlClient = new GraphQLClient("/api/graphql");

export const STATS_QUERY = `
  query myQuery {
    PoolManager(where: {chainId: {_eq: "130"}}) {      
      numberOfSwaps
      poolCount
      id
      txCount
      totalFeesETH
      totalFeesUSD
      totalValueLockedETH
      totalValueLockedUSD
      totalVolumeETH
      totalVolumeUSD
      untrackedVolumeUSD
    }
    chain_metadata(where: {chain_id: {_eq: 130}}) {
      chain_id
      latest_fetched_block_number
    }
  }
`;

export const POOLS_QUERY = `
  query myQuery {
  Pool(
    order_by: {totalValueLockedUSD: desc}
    limit: 100
    where: {chainId: {_eq: "130"}}
  ) {
    id
    name
    txCount
    token0
    token1
    volumeUSD
    untrackedVolumeUSD
    feesUSD
    totalValueLockedUSD
    hooks
    feeTier
    tickSpacing
  }
}
`;

export const POOLS_BY_HOOK_QUERY = `
  query poolsByHook($hookAddress: String!, $chainId: numeric!) {
    Pool(where: {hooks: {_eq: $hookAddress}, chainId: {_eq: $chainId}}, order_by: {totalValueLockedUSD: desc}) {
      chainId
      hooks
      id
      name
      txCount
      token0
      token1
      volumeUSD
      untrackedVolumeUSD
      feesUSD
      feesUSDUntracked
      totalValueLockedUSD
      createdAtTimestamp
    }
  }
`;

export const RECENT_SWAPS_BY_POOL_QUERY = `
  query recentSwapsByPool($poolId: String!, $limit: Int!) {
    Swap(
      where: {pool: {_eq: $poolId}}, 
      order_by: {timestamp: desc}, 
      limit: $limit
    ) {
      id
      amount0
      amount1
      amountUSD
      origin
      sender
      timestamp
      transaction
      pool
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      sqrtPriceX96
      tick
    }
  }
`;
