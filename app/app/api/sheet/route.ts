export async function GET() {
  const sheetId = "1EwSWZ9XsyRY_HBNq9elmEsN35wbvGZZ12Rn_7FJGD8o";
  const sheetName = "Adulwahab M Alshammari";

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;

  const response = await fetch(url);
  const text = await response.text();

  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);

  if (!match) {
    return new Response(JSON.stringify({ error: "Failed to parse sheet" }), {
      status: 500,
    });
  }

  const json = JSON.parse(match[1]);

  return Response.json(json);
}
