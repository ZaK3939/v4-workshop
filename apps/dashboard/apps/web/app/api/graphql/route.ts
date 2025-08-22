import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Use local indexer endpoint
    const endpoint = process.env.ENVIO_GRAPHQL_ENDPOINT || "http://localhost:8080/v1/graphql";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GraphQL HTTP error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse GraphQL response:", responseText);
      throw new Error(`Invalid JSON response: ${parseError}`);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("GraphQL proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
