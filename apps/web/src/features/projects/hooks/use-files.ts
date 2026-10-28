import { useMutation, useQuery } from "convex/react";
import { api } from "@pursor/backend/convex/_generated/api";
import { Id } from "@pursor/backend/convex/_generated/dataModel";
import {
  optimisticallyCreateFile,
  optimisticallyDeleteFile,
  optimisticallyRenameFile,
} from "./file-optimistic-updates";

export const useCreateFile = () => {
  return useMutation(api.files.createFile).withOptimisticUpdate((store, args) => {
    optimisticallyCreateFile(store, args, "file");
  });
};

export const useCreateFolder = () => {
  return useMutation(api.files.createFolder).withOptimisticUpdate((store, args) => {
    optimisticallyCreateFile(store, args, "folder");
  });
};

export const useRenameFile = () => {
  return useMutation(api.files.renameFile).withOptimisticUpdate(optimisticallyRenameFile);
};

export const useDeleteFile = () => {
  return useMutation(api.files.deleteFile).withOptimisticUpdate(optimisticallyDeleteFile);
};

export const useFolderContents = ({
  projectId,
  parentId,
  enabled = true,
}: {
  projectId: Id<"projects">;
  parentId?: Id<"files">;
  enabled?: boolean;
}) => {
  return useQuery(api.files.getFolderContents, enabled ? { projectId, parentId } : "skip");
};
