import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectIdView } from "./project-id-view";

const projectId = "project" as Id<"projects">;
const folderId = "folder" as Id<"files">;
const file = {
  _id: "file",
  projectId,
  type: "file",
  name: "index.ts",
  content: "const hello = 'world';",
} as Doc<"files">;

vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("allotment", () => {
  const Pane = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Allotment: Object.assign(Pane, { Pane }) };
});
vi.mock("./file-explorer", () => ({
  FileExplorer: ({
    activeFileId,
    onOpenFile,
    onDeleteItem,
    onRenameItem,
  }: {
    activeFileId?: Id<"files">;
    onOpenFile: (file: Doc<"files">, ancestorIds: Id<"files">[]) => void;
    onDeleteItem: (id: Id<"files">) => void;
    onRenameItem: (id: Id<"files">, name: string) => void;
  }) => (
    <div>
      <button aria-pressed={activeFileId === file._id} onClick={() => onOpenFile(file, [folderId])}>
        Open file
      </button>
      <button onClick={() => onDeleteItem(file._id)}>Delete file</button>
      <button onClick={() => onDeleteItem(folderId)}>Delete parent</button>
      <button onClick={() => onDeleteItem("other" as Id<"files">)}>Delete unrelated</button>
      <button onClick={() => onRenameItem(file._id, "renamed.ts")}>Rename file</button>
    </div>
  ),
}));

afterEach(cleanup);

describe("ProjectIdView file selection", () => {
  it("opens file content, marks selection active, and closes it", () => {
    render(<ProjectIdView projectId={projectId} />);
    fireEvent.click(screen.getByText("Open file"));
    expect(screen.getByText(file.content!)).toBeTruthy();
    expect(screen.getByText("Open file").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close index.ts" }));
    expect(screen.queryByText(file.content!)).toBeNull();
    expect(screen.getByText("Open file").getAttribute("aria-pressed")).toBe("false");
  });

  it.each(["Delete file", "Delete parent"])("clears selection on %s", (action) => {
    render(<ProjectIdView projectId={projectId} />);
    fireEvent.click(screen.getByText("Open file"));
    fireEvent.click(screen.getByText(action));
    expect(screen.queryByText(file.content!)).toBeNull();
    expect(screen.getByText("Open file").getAttribute("aria-pressed")).toBe("false");
  });

  it("preserves unrelated selection and updates the renamed title", () => {
    render(<ProjectIdView projectId={projectId} />);
    fireEvent.click(screen.getByText("Open file"));
    fireEvent.click(screen.getByText("Delete unrelated"));
    expect(screen.getByText(file.content!)).toBeTruthy();
    fireEvent.click(screen.getByText("Rename file"));
    expect(screen.getByRole("button", { name: "Close renamed.ts" })).toBeTruthy();
  });
});
