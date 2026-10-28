import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tree } from "./tree";

const mocks = vi.hoisted(() => ({
  createFile: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  deleteFile: vi.fn(),
  contents: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../hooks/use-files", () => ({
  useCreateFile: () => mocks.createFile,
  useCreateFolder: () => mocks.createFolder,
  useRenameFile: () => mocks.renameFile,
  useDeleteFile: () => mocks.deleteFile,
  useFolderContents: (args: unknown) => mocks.contents(args),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@react-symbols/icons/utils", () => ({ FileIcon: () => null, FolderIcon: () => null }));
vi.mock("./tree-item-wrapper", () => ({
  TreeItemWrapper: ({
    children,
    onClick,
    onRename,
    onDelete,
    onCreateFile,
    onCreateFolder,
    isActive,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onCreateFile?: () => void;
    onCreateFolder?: () => void;
    isActive?: boolean;
    disabled?: boolean;
  }) => (
    <div>
      <button disabled={disabled} onClick={onClick} aria-pressed={!!isActive}>
        {children}
      </button>
      <button disabled={disabled} onClick={onRename}>
        Rename
      </button>
      <button disabled={disabled} onClick={onDelete}>
        Delete
      </button>
      {onCreateFile && (
        <button disabled={disabled} onClick={onCreateFile}>
          New File
        </button>
      )}
      {onCreateFolder && (
        <button disabled={disabled} onClick={onCreateFolder}>
          New Folder
        </button>
      )}
    </div>
  ),
}));

const projectId = "project" as Id<"projects">;
const folder = { _id: "folder", name: "src", type: "folder", projectId } as Doc<"files">;
const file = {
  _id: "file",
  name: "index.ts",
  type: "file",
  projectId,
  content: "hello",
} as Doc<"files">;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.contents.mockReturnValue([]);
  mocks.createFile.mockResolvedValue("created");
  mocks.createFolder.mockResolvedValue("created");
  mocks.renameFile.mockResolvedValue(null);
  mocks.deleteFile.mockResolvedValue(null);
});
afterEach(cleanup);

describe("Tree", () => {
  it.each([file, folder])("disables actions on temporary $type rows", (item) => {
    const onOpenFile = vi.fn();
    render(
      <Tree
        item={{ ...item, _id: "optimistic:temporary" as Id<"files"> }}
        projectId={projectId}
        onOpenFile={onOpenFile}
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(mocks.createFile).not.toHaveBeenCalled();
    expect(mocks.createFolder).not.toHaveBeenCalled();
    expect(mocks.renameFile).not.toHaveBeenCalled();
    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(mocks.contents).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });
  it("does not display a creation input when expanding a folder", () => {
    render(<Tree item={folder} projectId={projectId} />);
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.contents).toHaveBeenLastCalledWith({
      projectId,
      parentId: folder._id,
      enabled: true,
    });
  });

  it.each(["file", "folder"] as const)("creates a %s only after submission", async (type) => {
    render(<Tree item={folder} projectId={projectId} />);
    fireEvent.click(screen.getByText(type === "file" ? "New File" : "New Folder"));
    const input = screen.getByRole("textbox", { name: `New ${type} name` });
    fireEvent.change(input, { target: { value: " child " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    const mutation = type === "file" ? mocks.createFile : mocks.createFolder;
    expect(mutation).toHaveBeenCalledExactlyOnceWith({
      projectId,
      parentId: folder._id,
      name: "child",
      ...(type === "file" ? { content: "" } : {}),
    });
    expect(type === "file" ? mocks.createFolder : mocks.createFile).not.toHaveBeenCalled();
  });

  it("cancels creation without submitting on blur", () => {
    render(<Tree item={folder} projectId={projectId} />);
    fireEvent.click(screen.getByText("New File"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "cancel.ts" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.createFile).not.toHaveBeenCalled();
  });

  it("prevents duplicate Enter/blur submissions and retains failed input for retry", async () => {
    let reject!: (error: Error) => void;
    mocks.createFile.mockReturnValueOnce(
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    render(<Tree item={folder} projectId={projectId} />);
    fireEvent.click(screen.getByText("New File"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "child.ts" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.createFile).toHaveBeenCalledTimes(1));
    await act(async () => reject(new Error("Duplicate name")));
    expect(mocks.error).toHaveBeenCalledWith("Duplicate name");
    expect(input.value).toBe("child.ts");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(mocks.createFile).toHaveBeenCalledTimes(2);
  });

  it.each([file, folder])("renames $type items", async (item) => {
    const onRenameItem = vi.fn();
    render(<Tree item={item} projectId={projectId} onRenameItem={onRenameItem} />);
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByRole("textbox", { name: `Rename ${item.name}` });
    expect((input as HTMLInputElement).value).toBe(item.name);
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(mocks.renameFile).toHaveBeenCalledWith({ id: item._id, newName: "renamed" });
    expect(onRenameItem).toHaveBeenCalledWith(item._id, "renamed");
  });

  it("opens nested files with their ancestor path and active styling", () => {
    mocks.contents.mockImplementation(({ parentId }: { parentId: string }) =>
      parentId === folder._id ? [file] : [],
    );
    const onOpenFile = vi.fn();
    render(
      <Tree item={folder} projectId={projectId} activeFileId={file._id} onOpenFile={onOpenFile} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    const row = screen.getByRole("button", { name: "index.ts" });
    expect(row.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(row);
    expect(onOpenFile).toHaveBeenCalledWith(file, [folder._id]);
  });

  it("notifies deletion only after success and reports failures", async () => {
    const onDeleteItem = vi.fn();
    mocks.deleteFile.mockRejectedValueOnce(new Error("Access denied"));
    render(<Tree item={folder} projectId={projectId} onDeleteItem={onDeleteItem} />);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Access denied"));
    expect(onDeleteItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(onDeleteItem).toHaveBeenCalledWith(folder._id));
  });
});
