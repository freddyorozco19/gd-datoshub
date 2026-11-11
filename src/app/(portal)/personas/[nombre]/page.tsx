import PersonaView from "@/components/modules/personas/PersonaView";

export default async function PersonaPage({ params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  return <PersonaView name={decodeURIComponent(nombre)} />;
}
