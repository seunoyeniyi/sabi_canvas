import {
  Project,
  STORAGE_PROJECTS_KEY,
  STORAGE_LAST_PROJECT_KEY,
} from '@sabi-canvas/types/project';

type ProjectsStore = Record<string, Project>;

const readStore = (): ProjectsStore => {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as ProjectsStore;
  } catch {
    return {};
  }
};

const writeStore = (store: ProjectsStore): void => {
  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded or private browsing — silently skip
  }
};

export const loadAllProjects = (): Project[] => {
  const store = readStore();
  return Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getProject = (id: string): Project | null => {
  const store = readStore();
  return store[id] ?? null;
};

export const saveProject = (project: Project): void => {
  const store = readStore();
  store[project.id] = project;
  writeStore(store);
};

export const deleteProject = (id: string): void => {
  const store = readStore();
  delete store[id];
  writeStore(store);
};

export const getLastProjectId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_LAST_PROJECT_KEY);
  } catch {
    return null;
  }
};

export const setLastProjectId = (id: string | null): void => {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_LAST_PROJECT_KEY);
    } else {
      localStorage.setItem(STORAGE_LAST_PROJECT_KEY, id);
    }
  } catch {
    // silently skip
  }
};
