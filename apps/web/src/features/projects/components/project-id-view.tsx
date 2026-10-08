import type { Id } from "@pursor/backend/convex/_generated/dataModel";

export const ProjectIdView = ({ projectId }: { projectId: Id<"projects"> }) => {
  return <div>Project View Id {projectId}</div>;
};
