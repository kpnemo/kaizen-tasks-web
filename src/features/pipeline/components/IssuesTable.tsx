import type { PipelineIssue } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The issues in snapshot order: open ones first, then those shipped in the last 14 days. */
export function IssuesTable({ issues }: { issues: PipelineIssue[] }) {
  return (
    <Table aria-label="Issues" className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Issue</TableHead>
          <TableHead>Stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.number}>
            <TableCell>
              #{issue.number} {issue.title}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{issue.stage}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
