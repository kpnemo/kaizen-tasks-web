import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { RequestFeaturePage } from "@/features/feature-request/RequestFeaturePage";
import { TagsPage } from "@/features/tags/TagsPage";
import { TaskDetailPage } from "@/features/tasks/TaskDetailPage";
import { TaskListPage } from "@/features/tasks/TaskListPage";
import { AppShell } from "./layout";
import { NotFoundPage } from "./routes/NotFoundPage";
import { PublicOnly } from "./routes/PublicOnly";
import { RequireAuth } from "./routes/RequireAuth";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/tasks" element={<TaskListPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/request-feature" element={<RequestFeaturePage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/tasks" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
