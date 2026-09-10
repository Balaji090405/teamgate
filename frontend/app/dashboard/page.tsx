'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  getCurrentSession,
  getIdToken,
  getRoleFromToken,
  logout,
} from '@/lib/auth';

type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

type TeamUser = {
  id: string;
  email: string;
  role: string;
};

export default function Dashboard() {
  const router = useRouter();

  // ==========================================
  // GENERAL STATE
  // ==========================================

  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // CREATE PROJECT STATE
  // ==========================================

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // ==========================================
  // EDIT PROJECT STATE
  // ==========================================

  const [editingProject, setEditingProject] =
    useState<Project | null>(null);

  const [updating, setUpdating] = useState(false);

  // ==========================================
  // USER MANAGEMENT STATE
  // ==========================================

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [changingRole, setChangingRole] =
    useState<string | null>(null);

  // ==========================================
  // MESSAGES
  // ==========================================

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ==========================================
  // LOAD PROJECTS
  // ==========================================

  const loadProjects = useCallback(async () => {
    const token = getIdToken();

    if (!token) {
      router.push('/');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status}`,
        );
      }

      const data = await response.json();

      setProjects(data.projects ?? []);
    } catch (err) {
      console.error(err);
      setError('Unable to load projects.');
    }
  }, [router]);

  // ==========================================
  // LOAD USERS
  // ADMIN ONLY
  // ==========================================

  const loadUsers = useCallback(async () => {
    const token = getIdToken();

    if (!token) {
      router.push('/');
      return;
    }

    setUsersLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to load users.',
        );
      }

      setUsers(data.users ?? []);
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load users.');
      }
    } finally {
      setUsersLoading(false);
    }
  }, [router]);

  // ==========================================
  // CHANGE USER ROLE
  // ADMIN ONLY
  // ==========================================

  const handleChangeRole = useCallback(
    async (userId: string, newRole: string) => {
      const token = getIdToken();

      if (!token) {
        router.push('/');
        return;
      }

      setChangingRole(userId);
      setError('');
      setMessage('');

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: newRole,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Failed to change user role.',
          );
        }

        setMessage(
          'User role updated successfully.',
        );

        await loadUsers();
      } catch (err) {
        console.error(err);

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to change user role.');
        }
      } finally {
        setChangingRole(null);
      }
    },
    [loadUsers, router],
  );

  // ==========================================
  // INITIAL DASHBOARD LOAD
  // ==========================================

  useEffect(() => {
    async function loadDashboard() {
      const session = getCurrentSession();

      if (!session || !session.isValid()) {
        router.push('/');
        return;
      }

      const userRole = getRoleFromToken();

      setRole(userRole);

      await loadProjects();

      if (userRole === 'Admin') {
        await loadUsers();
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router, loadProjects, loadUsers]);

  // ==========================================
  // CREATE PROJECT
  // ==========================================

  async function handleCreateProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setCreating(true);
    setMessage('');
    setError('');

    const token = getIdToken();

    if (!token) {
      router.push('/');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to create project.',
        );
      }

      setName('');
      setDescription('');

      setMessage(
        'Project created successfully.',
      );

      await loadProjects();
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create project.');
      }
    } finally {
      setCreating(false);
    }
  }

  // ==========================================
  // UPDATE PROJECT
  // ==========================================

  async function handleUpdateProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editingProject) {
      return;
    }

    const token = getIdToken();

    if (!token) {
      router.push('/');
      return;
    }

    setUpdating(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${editingProject.id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editingProject.name,
            description: editingProject.description,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to update project.',
        );
      }

      setEditingProject(null);

      setMessage(
        'Project updated successfully.',
      );

      await loadProjects();
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update project.');
      }
    } finally {
      setUpdating(false);
    }
  }

  // ==========================================
  // DELETE PROJECT
  // ==========================================

  async function handleDeleteProject(id: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this project?',
    );

    if (!confirmed) {
      return;
    }

    const token = getIdToken();

    if (!token) {
      router.push('/');
      return;
    }

    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to delete project.',
        );
      }

      setMessage(
        'Project deleted successfully.',
      );

      await loadProjects();
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete project.');
      }
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  function handleLogout() {
    logout();
    router.push('/');
  }

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading dashboard...
        </p>
      </main>
    );
  }

  // ==========================================
  // PERMISSIONS
  // ==========================================

  const canCreate =
    role === 'Admin' || role === 'Manager';

  const canEdit =
    role === 'Admin' || role === 'Manager';

  const canDelete =
    role === 'Admin';

  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* ==========================================
          HEADER
      ========================================== */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              TeamGate
            </h1>

            <p className="text-sm text-gray-500">
              Project Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {role ?? 'Unknown'}
            </span>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>

          </div>

        </div>
      </header>

      {/* ==========================================
          MAIN CONTENT
      ========================================== */}

      <section className="mx-auto max-w-6xl px-6 py-8">

        {/* PAGE TITLE */}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Projects
          </h2>

          <p className="mt-1 text-gray-600">
            View the projects available to your team.
          </p>
        </div>

        {/* ==========================================
            SUCCESS MESSAGE
        ========================================== */}

        {message && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* ==========================================
            ERROR MESSAGE
        ========================================== */}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ==========================================
            CREATE PROJECT
        ========================================== */}

        {canCreate && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow">

            <h3 className="mb-4 text-xl font-semibold text-gray-900">
              Create Project
            </h3>

            <form
              onSubmit={handleCreateProject}
              className="space-y-4"
            >

              <div>
                <label
                  htmlFor="project-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Project Name
                </label>

                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Employee Portal"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label
                  htmlFor="project-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="project-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe the project..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? 'Creating...'
                  : 'Create Project'}
              </button>

            </form>

          </div>
        )}

        {/* ==========================================
            EDIT PROJECT
        ========================================== */}

        {editingProject && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow">

            <h3 className="mb-4 text-xl font-semibold text-gray-900">
              Edit Project
            </h3>

            <form
              onSubmit={handleUpdateProject}
              className="space-y-4"
            >

              <div>
                <label
                  htmlFor="edit-project-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Project Name
                </label>

                <input
                  id="edit-project-name"
                  type="text"
                  value={editingProject.name}
                  onChange={(event) =>
                    setEditingProject({
                      ...editingProject,
                      name: event.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-project-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="edit-project-description"
                  value={editingProject.description}
                  onChange={(event) =>
                    setEditingProject({
                      ...editingProject,
                      description: event.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="flex gap-3">

                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updating
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditingProject(null)
                  }
                  className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

              </div>

            </form>

          </div>
        )}

        {/* ==========================================
            ADMIN USER MANAGEMENT
        ========================================== */}

        {role === 'Admin' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow">

            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              User Management
            </h3>

            <p className="mb-6 text-sm text-gray-600">
              Admins can change the role of team members.
            </p>

            {usersLoading ? (

              <p className="text-gray-500">
                Loading users...
              </p>

            ) : users.length === 0 ? (

              <p className="text-gray-500">
                No users found.
              </p>

            ) : (

              <div className="space-y-4">

                {users.map((user) => (

                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                  >

                    <div>
                      <p className="font-medium text-gray-900">
                        {user.email}
                      </p>

                      <p className="text-sm text-gray-500">
                        Current role: {user.role}
                      </p>
                    </div>

                    <select
                      value={user.role}
                      disabled={
                        changingRole === user.id
                      }
                      onChange={(event) =>
                        handleChangeRole(
                          user.id,
                          event.target.value,
                        )
                      }
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Admin">
                        Admin
                      </option>

                      <option value="Manager">
                        Manager
                      </option>

                      <option value="Employee">
                        Employee
                      </option>
                    </select>

                  </div>

                ))}

              </div>

            )}

          </div>
        )}

        {/* ==========================================
            PROJECT LIST
        ========================================== */}

        {projects.length === 0 ? (

          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-gray-500">
              No projects found.
            </p>
          </div>

        ) : (

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            {projects.map((project) => (

              <div
                key={project.id}
                className="rounded-xl bg-white p-6 shadow"
              >

                <h3 className="text-lg font-semibold text-gray-900">
                  {project.name}
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  {project.description ||
                    'No description provided.'}
                </p>

                <p className="mt-4 text-xs text-gray-400">
                  Created:{' '}
                  {new Date(
                    project.createdAt,
                  ).toLocaleString()}
                </p>

                {/* EDIT */}

                {canEdit && (
                  <button
                    onClick={() =>
                      setEditingProject(project)
                    }
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}

                {/* DELETE */}

                {canDelete && (
                  <button
                    onClick={() =>
                      handleDeleteProject(project.id)
                    }
                    className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}

              </div>

            ))}

          </div>

        )}

      </section>

    </main>
  );
}