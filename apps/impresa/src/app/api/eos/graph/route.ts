import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";

// GET: Recupera l'intero grafo DAG memorizzato su Neo4j
export async function GET() {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (n:EosAction)
      OPTIONAL MATCH (n)-[r:DEPENDS_ON]->(m:EosAction)
      RETURN n, r, m
    `);

    const nodesMap = new Map();
    const links: { source: string; target: string }[] = [];

    result.records.forEach((record) => {
      const nodeA = record.get("n")?.properties;
      const nodeB = record.get("m")?.properties;

      if (nodeA && !nodesMap.has(nodeA.id)) {
        nodesMap.set(nodeA.id, { ...nodeA });
      }
      if (nodeB && !nodesMap.has(nodeB.id)) {
        nodesMap.set(nodeB.id, { ...nodeB });
      }
      if (nodeA && nodeB) {
        links.push({ source: nodeB.id, target: nodeA.id });
      }
    });

    return NextResponse.json({
      nodes: Array.from(nodesMap.values()),
      links,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Errore durante la lettura da Neo4j", details: error.message },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

// POST: Sincronizza il catalogo locale actionsStore dentro Neo4j (Cypher UPSERT)
export async function POST(req: Request) {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const { actions } = await req.json();

    if (!Array.isArray(actions)) {
      return NextResponse.json({ error: "Payload non valido" }, { status: 400 });
    }

    const tx = session.beginTransaction();

    // 1. Unwind ed Esecuzione MERGE sui nodi
    await tx.run(
      `
      UNWIND $actions AS act
      MERGE (a:EosAction { id: act.id })
      SET a.name = act.name,
          a.type = act.origin,
          a.status = act.status,
          a.action_id = act.action_id,
          a.description = act.description
      `,
      { actions }
    );

    // 2. Pulizia e ricreazione delle relazioni DEPENDS_ON basate su I/O
    await tx.run(`MATCH ()-[r:DEPENDS_ON]->() DELETE r`);

    await tx.run(
      `
      UNWIND $actions AS act
      UNWIND act.inputs AS input_key
      MATCH (target:EosAction { id: act.id })
      MATCH (source:EosAction) WHERE input_key IN source.outputs
      MERGE (target)-[:DEPENDS_ON]->(source)
      `,
      { actions }
    );

    await tx.commit();
    return NextResponse.json({ success: true, count: actions.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Errore di sincronizzazione con Neo4j", details: error.message },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
