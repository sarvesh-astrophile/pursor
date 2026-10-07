import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@pursor/backend/convex/_generated/api";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { useCallback } from "react";

export const useProjectById = (id: Id<"projects">) => {
  const { isAuthenticated } = useConvexAuth();
  const project = useQuery(api.projects.getById, isAuthenticated ? { id } : "skip");
  return project;
};

export const useProjects = () => {
  const { isAuthenticated } = useConvexAuth();
  const projects = useQuery(api.projects.get, isAuthenticated ? {} : "skip");
  return projects;
};

export const useProjectsPartial = (limit: number) => {
  const { isAuthenticated } = useConvexAuth();
  const projects = useQuery(api.projects.getPartial, isAuthenticated ? { limit } : "skip");
  return projects;
};

export const useCreateProject = () => {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
  const createProject = useMutation(api.projects.create).withOptimisticUpdate((localStore, arg) => {
    if (!isAuthenticated || !user || !arg.name.trim()) return;

    const now = Date.now();
    const newProject: Doc<"projects"> = {
      _id: crypto.randomUUID() as Id<"projects">,
      _creationTime: now,
      name: arg.name.trim(),
      ownerId: user._id,
      updatedAt: now,
    };
    const existingProjects = localStore.getQuery(api.projects.get, {});

    if (existingProjects !== undefined) {
      localStore.setQuery(api.projects.get, {}, [newProject, ...existingProjects].slice(0, 100));
    }

    for (const { args, value } of localStore.getAllQueries(api.projects.getPartial)) {
      if (value !== undefined) {
        localStore.setQuery(
          api.projects.getPartial,
          args,
          [newProject, ...value].slice(0, args.limit),
        );
      }
    }
  });
  return createProject;
};

export const useRenameProject = (projectId: Id<"projects">) => {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
  const renameProject = useMutation(api.projects.rename).withOptimisticUpdate((localStore, arg) => {
    if (!isAuthenticated || !user) return;

    const updatedAt = Date.now();
    const updateProject = (project: Doc<"projects">): Doc<"projects"> =>
      project._id === arg.id && project.ownerId === user._id
        ? { ...project, name: arg.name, updatedAt }
        : project;
    const existingProject = localStore.getQuery(api.projects.getById, { id: arg.id });

    if (existingProject !== undefined && existingProject !== null) {
      localStore.setQuery(api.projects.getById, { id: arg.id }, updateProject(existingProject));
    }

    const existingProjects = localStore.getQuery(api.projects.get, {});
    if (existingProjects !== undefined) {
      localStore.setQuery(api.projects.get, {}, existingProjects.map(updateProject));
    }

    for (const { args, value } of localStore.getAllQueries(api.projects.getPartial)) {
      if (value !== undefined) {
        localStore.setQuery(api.projects.getPartial, args, value.map(updateProject));
      }
    }
  });
  return useCallback(
    ({ name }: { name: string }) => renameProject({ id: projectId, name }),
    [projectId, renameProject],
  );
};
