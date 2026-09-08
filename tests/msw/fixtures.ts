import type { User } from "@/api/models";

export const ISO = "2026-09-01T09:00:00.000Z";

export const demoUser: User = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "demo@kaizen.local",
  displayName: "Demo",
  createdAt: ISO,
};
