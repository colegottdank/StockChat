import { resolve } from "path";
import { HeliconeManualLogger } from "@helicone/helpers";
import { OpenAI } from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import crypto from "crypto";

require("dotenv").config({ path: resolve(__dirname, "../.env") });

const mockEmails = [
  "investor1@example.com",
  "trader123@example.com",
  "stockanalyst@example.com",
  "marketwatcher@example.com",
  "daytrader42@example.com",
  "portfoliomanager@example.com",
  "techinvestor@example.com",
  "valueinvestor@example.com",
];

const stockTickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "META", "TSLA"];

const openai = new OpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY ?? ""}`,
  },
});

const heliconeLogger = new HeliconeManualLogger({
  apiKey: process.env.HELICONE_API_KEY ?? "",
});

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_stock_price",
      description: "Get real-time stock price data",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "Stock ticker symbol",
          },
        },
        required: ["ticker"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_technical_analysis",
      description: "Get technical analysis metrics",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "Stock ticker symbol",
          },
        },
        required: ["ticker"],
      },
    },
  },
];

async function analyzeStock(
  ticker: string,
  parentSessionId: string,
  randomEmail: string
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "<helicone-prompt-static>You are a stock analysis assistant. You help users make informed investment decisions by analyzing stocks using technical and fundamental data.</helicone-prompt-static>",
    },
    {
      role: "user",
      content: `Analyze ${ticker} stock.`,
    },
  ];

  const sessionHeaders = {
    "Helicone-Session-ID": parentSessionId,
    "Helicone-Session-Path": `/stock/${ticker.toLowerCase()}-agent`,
    "Helicone-Session-Name": "Stock Analysis",
    "Helicone-Property-Type": "Stock-Analysis-Agent",
    "Helicone-User-Id": randomEmail,
  };

  // 1. Initial Response
  const initialResponse = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages,
      tools,
    },
    {
      headers: {
        ...sessionHeaders,
        "Helicone-Prompt-Id": "initial-stock-analysis",
      },
    }
  );

  // 2. Data Collection - Mock tool calls
  const stockPrice = await heliconeLogger.logRequest(
    {
      _type: "tool",
      toolName: "get_stock_price",
      input: { ticker: "AAPL" },
      metadata: {
        requestTime: new Date().toISOString(),
        source: "mock_data",
      },
    },
    async (resultRecorder) => {
      const mockPrice = { price: 175.34, change: 2.45 };
      resultRecorder.appendResults({
        output: mockPrice,
        executionTime: Date.now(),
        status: "success",
      });
      return mockPrice;
    },
    sessionHeaders
  );

  // 3. Vector DB Search - Mock sentiment data
  const sentimentData = await heliconeLogger.logRequest(
    {
      _type: "vector_db",
      operation: "search",
      text: `${ticker} recent market sentiment and news analysis`,
      vector: [0.1, 0.2, 0.3, 0.4], // Example embedding vector
      topK: 5,
      filter: {
        timeRange: "7d",
        sources: ["news", "reddit", "twitter"],
      },
      databaseName: "market_sentiment_db",
      metadata: {
        requestTime: new Date().toISOString(),
        source: "mock_sentiment_db",
        searchParameters: {
          threshold: 0.8,
        },
      },
    },
    async (resultRecorder) => {
      const mockSentiment = {
        reddit_sentiment: 0.75,
        news_sentiment: 0.82,
      };
      resultRecorder.appendResults({
        results: mockSentiment,
        matchCount: 1,
        searchLatency: 50, // ms
        status: "success",
      });
      return mockSentiment;
    },
    sessionHeaders
  );

  // 4. Technical Analysis - Mock data
  const technicalAnalysis = await heliconeLogger.logRequest(
    {
      _type: "tool",
      toolName: "get_technical_analysis",
      input: { ticker: "AAPL" },
      metadata: {
        requestTime: new Date().toISOString(),
        source: "mock_technical_analysis",
        timeframe: "1d",
      },
    },
    async (resultRecorder) => {
      const mockAnalysis = {
        rsi: 62,
        macd: { signal: "buy", value: 2.34 },
        moving_averages: { ma50: 170.25, ma200: 165.8 },
      };
      resultRecorder.appendResults({
        output: mockAnalysis,
        executionTime: Date.now(),
        status: "success",
        indicators: ["rsi", "macd", "moving_averages"],
      });
      return mockAnalysis;
    },
    sessionHeaders
  );

  // 5. Final Analysis
  messages.push({
    role: "assistant",
    content:
      "<helicone-prompt-static>I've gathered all the necessary data. Let me analyze it for you.</helicone-prompt-static>",
  });
  messages.push({
    role: "function",
    name: "get_stock_price",
    content: JSON.stringify(stockPrice),
  });
  messages.push({
    role: "function",
    name: "get_technical_analysis",
    content: JSON.stringify(technicalAnalysis),
  });

  const finalResponse = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages,
    },
    {
      headers: {
        ...sessionHeaders,
        "Helicone-Prompt-Id": "final-stock-analysis",
      },
    }
  );

  return finalResponse.choices[0].message.content || "";
}

async function runAnalysis() {
  const chatSessionId = crypto.randomUUID();
  const randomEmail = mockEmails[Math.floor(Math.random() * mockEmails.length)];
  const firstStock =
    stockTickers[Math.floor(Math.random() * stockTickers.length)];
  let secondStock: string;
  do {
    secondStock = stockTickers[Math.floor(Math.random() * stockTickers.length)];
  } while (secondStock === firstStock);

  console.log(`\nStarting analysis run with ${firstStock} and ${secondStock}`);
  console.log(`Session ID: ${chatSessionId}`);
  console.log(`User: ${randomEmail}\n`);

  const sessionHeaders = {
    "Helicone-Session-ID": chatSessionId,
    "Helicone-Session-Path": "/stock",
    "Helicone-Session-Name": "Stock Analysis",
    "Helicone-Property-Type": "Stock-Analysis-Chat",
    "Helicone-User-Id": randomEmail,
  };

  let messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "<helicone-prompt-static>You are a friendly stock market assistant. You can help users analyze stocks and answer general market questions. When users ask about specific stocks, you'll call the analysis agent to get detailed information.</helicone-prompt-static>",
    },
    {
      role: "user",
      content: "Hi! Can you help me analyze some stocks today?",
    },
  ];

  // Initial greeting
  const response = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages,
    },
    {
      headers: {
        ...sessionHeaders,
        "Helicone-Prompt-Id": "initial-greeting",
      },
    }
  );

  messages.push(response.choices[0].message);
  messages.push({
    role: "user",
    content: `Can you analyze ${firstStock} stock for me?`,
  });

  // Acknowledgment response for first stock
  const firstStockAckResponse = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages: [
        ...messages,
        {
          role: "system",
          content: `First acknowledge the comparison request and indicate you'll begin analyzing <helicone-prompt-input key="ticker">${firstStock}</helicone-prompt-input>. Keep it brief and friendly.`,
        },
      ],
    },
    {
      headers: {
        ...sessionHeaders,
        "Helicone-Prompt-Id": "analysis-ack",
      },
    }
  );

  messages.push(firstStockAckResponse.choices[0].message);

  // Now do the actual analysis with random stock
  const analysisResult = await analyzeStock(
    firstStock,
    chatSessionId,
    randomEmail
  );

  messages.push({
    role: "assistant",
    content: analysisResult,
  });

  // Update GOOGL comparison request to use second random stock
  messages.push({
    role: "user",
    content: `Thanks! Can you compare this with ${secondStock}?`,
  });

  // Acknowledgment response for second stock
  const secondStockAckResponse = await openai.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages: [
        ...messages,
        {
          role: "system",
          content: `First acknowledge the comparison request and indicate you'll begin analyzing <helicone-prompt-input key="ticker">${secondStock}</helicone-prompt-input>. Keep it brief and friendly.`,
        },
      ],
    },
    {
      headers: {
        ...sessionHeaders,
        "Helicone-Prompt-Id": "analysis-ack",
      },
    }
  );

  messages.push(secondStockAckResponse.choices[0].message);

  // Now do the GOOGL analysis
  const secondStockAnalysis = await analyzeStock(
    secondStock,
    chatSessionId,
    randomEmail
  );

  messages.push({
    role: "assistant",
    content: secondStockAnalysis,
  });

  // Create the full comparison response
  // const comparisonResponse = await openai.chat.completions.create(
  //   {
  //     model: "gpt-4o-mini",
  //     messages: [
  //       ...messages,
  //       {
  //         role: "assistant",
  //         content: secondStockAnalysis,
  //       },
  //     ],
  //   },
  //   { headers: sessionHeaders }
  // );

  // messages.push(comparisonResponse.choices[0].message);

  // console.log(comparisonResponse.choices[0].message);
}

async function main() {
  const numberOfRuns = 5;

  for (let i = 0; i < numberOfRuns; i++) {
    console.log(`\n=== Starting Run ${i + 1}/${numberOfRuns} ===`);
    await runAnalysis();
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
});

/*
Helicone Sessions Example:

Helicone sessions group multiple requests and responses together. 
Typically is will contain the full agentic flow including tool and vector search calls.

A session is defined by a unique Session ID (UUID) which you provide
"Helicone-Session-ID": <session-id>

The session Path defines the path of the session. For example, if the user asks about "AAPL", the path might be "/stock/aapl".
Ideally you don't overly nest the path as it can get complex quickly.
"Helicone-Session-Path": <path>

The session Name is a friendly name for the session. For example, "Stock Research Session".
"Helicone-Session-Name": <session-name>

*/

/*
Tool call logging example:

const res = await heliconeLogger.logRequest(
  {
    _type: "tool",
    toolName: "...", // The name of the tool used
    input: ..., // The input to the tool
    // other data which you want to store about the tool call
  },
  async (resultRecorder) => {
    // your tool call here
    resultRecorder.appendResults({
      ... // The results of the operation (this will be logged to Helicone)
    });
    return results; // this will be returned by the logRequest function
  },
  {
   // Additional headers to be sent with the request
  }
);
*/

/*
Vector DB logging example:

const res = await heliconeLogger.logRequest(
  {
    _type: "vector_db",
    operation: "search",
    // other data about the vector db request here (look at the API reference for more details)
  },
  async (resultRecorder) => {
    // your vector db operation here
    resultRecorder.appendResults({
      ... // The results of the operation (this will be logged to Helicone)
    });
    return results; // this will be returned by the logRequest function
  },
  {
   // Additional headers to be sent with the request
  }
);
*/
