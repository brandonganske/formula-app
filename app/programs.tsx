import { Redirect } from 'expo-router';

// Brand programs moved to the Deals tab. Keep the old route alive for links.
export default function ProgramsRedirect() {
  return <Redirect href={"/(tabs)/deals" as any} />;
}
