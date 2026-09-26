import { createFileRoute } from "@tanstack/react-router";

import { RemovalRequestScreen } from "@/features/importing/ui/removal-request-screen";

export const Route = createFileRoute("/sair-do-mural")({ component: RemovalRequestScreen });
