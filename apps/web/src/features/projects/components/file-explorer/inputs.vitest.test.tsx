import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateInput } from "./create-input";
import { RenameInput } from "./rename-input";

const mocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@react-symbols/icons/utils", () => ({ FileIcon: () => null, FolderIcon: () => null }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe.each([
  { mode: "create", Input: CreateInput },
  { mode: "rename", Input: RenameInput },
])("$mode input form", ({ Input }) => {
  it("submits a trimmed name on blur", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<Input type="file" level={0} onSubmit={onSubmit} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " new.ts " } });
    fireEvent.blur(input);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith("new.ts"));
  });

  it("cancels a blank submission without calling the mutation", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<Input type="folder" level={0} onSubmit={onSubmit} onCancel={onCancel} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels on Escape without submitting on a subsequent blur", () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<Input type="file" level={0} onSubmit={onSubmit} onCancel={onCancel} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new.ts" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("tracks pending submissions, blocks duplicates, and allows retry after failure", async () => {
    let reject!: (error: Error) => void;
    const onSubmit = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((_, rejectPromise) => {
          reject = rejectPromise;
        }),
      )
      .mockResolvedValue(null);
    const onCancel = vi.fn();
    render(<Input type="file" level={0} onSubmit={onSubmit} onCancel={onCancel} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "new.ts" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute("aria-busy")).toBe("true");
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => reject(new Error("Duplicate name")));
    await waitFor(() => expect(input.readOnly).toBe(false));
    expect(mocks.error).toHaveBeenCalledWith("Duplicate name");
    expect(input.value).toBe("new.ts");
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    fireEvent.blur(input);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
