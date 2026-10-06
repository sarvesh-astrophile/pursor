import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@pursor/backend/convex/_generated/api";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";

export const useProjects = () => {
  const projects = useQuery(api.projects.get);
  return projects;
};

export const useProjectsPartial = (limit: number) => {
  const projects = useQuery(api.projects.getPartial, { limit });
  return projects;
};

export const useCreateProject = () => {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
  const createProject = useMutation(api.projects.create).withOptimisticUpdate((localStore, arg) => {
    if (!user) return;

    const now = Date.now();
    const newProject: Doc<"projects"> = {
      _id: crypto.randomUUID() as Id<"projects">,
      _creationTime: now,
      name: arg.name.trim(),
      ownerId: user._id,
      updatedAt: now,
    };
    const existingProjects = localStore.getQuery(api.projects.get);

    if (existingProjects !== undefined) {
      localStore.setQuery(api.projects.get, {}, [...existingProjects, newProject].slice(0, 100));
    }

    for (const { args, value } of localStore.getAllQueries(api.projects.getPartial)) {
      if (value !== undefined) {
        localStore.setQuery(api.projects.getPartial, args, [...value, newProject].slice(0, args.limit));
      }
    }
  });
  return createProject;
};
