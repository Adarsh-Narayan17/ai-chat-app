const { SchemaType } = require("@google/generative-ai");
const agentToolDeclarations = [
  {
    name: "getWeather",
    description:
      "Get current weather conditions for a city. Use when the user asks about weather, temperature, rain, or conditions outdoors in a specific place.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: {
          type: SchemaType.STRING,
          description: "City name, e.g. Tokyo, New York, Mumbai",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "getCurrentDateTime",
    description:
      "Get the current date, local time, and day of the week. Use when the user asks what day/time it is, or needs today's date.",
  },
];

const GEMINI_TOOLS = [{ functionDeclarations: agentToolDeclarations }];
function weatherCodeLabel(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return "unknown";
  if (c === 0) return "clear sky";
  if (c <= 3) return "mainly clear / partly cloudy / overcast";
  if (c <= 48) return "fog";
  if (c <= 67) return "drizzle / rain";
  if (c <= 77) return "snow";
  if (c <= 82) return "rain showers";
  if (c <= 86) return "snow showers";
  if (c <= 99) return "thunderstorm / severe";
  return "variable";
}

async function getWeather(args) {
  const city = typeof args?.city === "string" ? args.city.trim() : "";
  if (!city) {
    return { ok: false, error: "Missing city name." };
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return { ok: false, error: `Geocoding failed (${geoRes.status}).` };
    }
    const geoData = await geoRes.json();
    const place = geoData?.results?.[0];
    if (!place) {
      return { ok: false, error: `Could not find a location matching "${city}".` };
    }

    const { latitude, longitude, name, country } = place;
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&timezone=auto`;

    const wxRes = await fetch(forecastUrl);
    if (!wxRes.ok) {
      return { ok: false, error: `Weather request failed (${wxRes.status}).` };
    }
    const wxData = await wxRes.json();
    const cur = wxData?.current;
    if (!cur) {
      return { ok: false, error: "Weather data unavailable for this location." };
    }

    const summary = weatherCodeLabel(cur.weather_code);
    return {
      ok: true,
      city: name,
      country: country ?? null,
      latitude,
      longitude,
      temperatureC: cur.temperature_2m,
      feelsLikeC: cur.apparent_temperature,
      humidityPercent: cur.relative_humidity_2m,
      windKmh: cur.wind_speed_10m,
      condition: summary,
      weatherCode: cur.weather_code,
      time: cur.time ?? null,
      timezone: wxData?.timezone ?? null,
    };
  } catch (e) {
    return { ok: false, error: e.message || "Weather lookup failed." };
  }
}

function getCurrentDateTime() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return {
    iso: now.toISOString(),
    unixMs: now.getTime(),
    weekday,
    dateLocal: dateStr,
    timeLocal: timeStr,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "server default",
  };
}

async function dispatchToolCall(name, args) {
  switch (name) {
    case "getWeather":
      return getWeather(args || {});
    case "getCurrentDateTime":
      return getCurrentDateTime();
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
async function runAgentUntilText(chatSession, firstUserMessage) {
  const MAX_ROUNDS = 8;
  let result = await chatSession.sendMessage(firstUserMessage);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = result.response;
    const calls = response.functionCalls?.();

    if (calls && calls.length > 0) {
      const parts = [];
      for (const call of calls) {
        const output = await dispatchToolCall(call.name, call.args);
        parts.push({
          functionResponse: {
            name: call.name,
            response: output,
          },
        });
      }
      result = await chatSession.sendMessage(parts);
      continue;
    }

    const text = response.text();
    if (text && text.trim()) return text;
    throw new Error("Model returned no text and no tool calls");
  }

  throw new Error("Agent tool loop exceeded maximum rounds");
}

module.exports = {
  GEMINI_TOOLS,
  runAgentUntilText,
  dispatchToolCall,
};
