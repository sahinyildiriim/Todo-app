import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function Home() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [categories, setCategories] = useState([]);
  const [showStats, setShowStats] = useState(false);
  
  // Modal form states
  const [modalForm, setModalForm] = useState({
    text: "",
    priority: "medium",
    category: "general",
    dueDate: "",
    notes: "",
    recurring: "none",
    tags: "",
  });

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const columns = [
    { id: "todo", title: "To Do", color: "from-blue-400 to-blue-600", icon: "📋" },
    { id: "inprogress", title: "In Progress", color: "from-yellow-400 to-yellow-600", icon: "⚙️" },
    { id: "done", title: "Done", color: "from-green-400 to-green-600", icon: "✅" },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      if (filterPriority) params.append("priority", filterPriority);
      if (filterCategory) params.append("category", filterCategory);
      if (sortBy && sortBy !== "createdAt") params.append("sortBy", sortBy);

      const url = params.toString()
        ? `/tasks/search?${params.toString()}`
        : "/tasks";

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Normalize tasks with default values for backward compatibility
      const normalizedTasks = res.data.map(task => ({
        ...task,
        priority: task.priority || "medium",
        category: task.category || "general",
        status: task.status || "todo",
        tags: task.tags || [],
        timeSpent: task.timeSpent || 0,
        recurring: task.recurring || "none",
        notes: task.notes || "",
      }));
      
      setTasks(normalizedTasks);
    } catch (err) {
      console.error(err);
    }
  }, [token, searchQuery, filterPriority, filterCategory, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/tasks/stats/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/tasks/categories/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
    fetchStats();
    fetchCategories();
  }, [fetchTasks, fetchStats, fetchCategories]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const addTask = async () => {
    if (!modalForm.text.trim()) return;
    try {
      const res = await api.post(
        "/tasks/add",
        {
          text: modalForm.text,
          priority: modalForm.priority,
          category: modalForm.category,
          dueDate: modalForm.dueDate || null,
          notes: modalForm.notes,
          recurring: modalForm.recurring,
          tags: modalForm.tags.split(",").map((t) => t.trim()).filter(t => t),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const taskWithId = { 
        ...res.data.task,
        _id: res.data.task._id || `tmp-${Date.now()}`,
        priority: res.data.task.priority || "medium",
        category: res.data.task.category || "general",
        status: res.data.task.status || "todo",
        tags: res.data.task.tags || [],
        timeSpent: res.data.task.timeSpent || 0,
        recurring: res.data.task.recurring || "none",
        notes: res.data.task.notes || "",
      };
      setTasks((prev) => [...prev, taskWithId]);
      setModalForm({
        text: "",
        priority: "medium",
        category: "general",
        dueDate: "",
        notes: "",
        recurring: "none",
        tags: "",
      });
      setShowModal(false);
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks((prev) => prev.filter((t) => t._id !== id));
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTask = async (id) => {
    try {
      await api.put(
        `/tasks/toggle/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTasks();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    setTasks((prev) =>
      prev.map((task) =>
        task._id === draggableId ? { ...task, status: destination.droppableId } : task
      )
    );

    try {
      await api.put(
        `/tasks/update-status/${draggableId}`,
        { status: destination.droppableId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchStats();
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isToday = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return (
      due.getDate() === today.getDate() &&
      due.getMonth() === today.getMonth() &&
      due.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className={`min-h-screen transition duration-300 ${
      theme === "dark"
        ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
        : "bg-gradient-to-br from-gray-50 to-gray-100"
    }`}>
      {/* Header */}
      <div className={`${
        theme === "dark"
          ? "bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700"
          : "bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200"
      } border-b shadow-lg transition duration-300`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-4xl font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                TaskHub
              </h1>
              <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                Organize your tasks
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStats(!showStats)}
                className={`${
                  theme === "dark"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-purple-500 hover:bg-purple-600"
                } text-white font-semibold px-6 py-2 rounded-lg transition duration-200 shadow-lg`}
              >
                📊 Statistics
              </button>
              <button
                onClick={toggleTheme}
                className={`${
                  theme === "dark"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-yellow-500 hover:bg-yellow-600"
                } text-white font-semibold px-4 py-2 rounded-lg transition duration-200 shadow-lg`}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition duration-200 shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard */}
      {showStats && stats && (
        <div className={`${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        } border-b border-gray-700 shadow-lg transition duration-300`}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              } p-4 rounded-lg border border-gray-600`}>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Total Tasks</p>
                <p className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {stats.total}
                </p>
              </div>
              <div className={`${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              } p-4 rounded-lg border border-gray-600`}>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Completed</p>
                <p className={`text-2xl font-bold text-green-500`}>{stats.completed}</p>
              </div>
              <div className={`${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              } p-4 rounded-lg border border-gray-600`}>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Overdue</p>
                <p className={`text-2xl font-bold text-red-500`}>{stats.overdue}</p>
              </div>
              <div className={`${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              } p-4 rounded-lg border border-gray-600`}>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Due Soon (7 days)</p>
                <p className={`text-2xl font-bold text-yellow-500`}>{stats.dueSoon}</p>
              </div>
              <div className={`${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              } p-4 rounded-lg border border-gray-600`}>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Completion %</p>
                <p className={`text-2xl font-bold text-blue-500`}>{stats.completionRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className={`${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        } rounded-xl p-6 shadow-xl border ${
          theme === "dark" ? "border-gray-700" : "border-gray-200"
        } mb-8 transition duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
            />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"
              }`}
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"
              }`}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"
              }`}
            >
              <option value="createdAt">Newest</option>
              <option value="dueDate">By Due Date</option>
              <option value="priority">By Priority</option>
            </select>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-200 shadow-lg"
            >
              ➕ New Task
            </button>
          </div>
        </div>

        {/* Task Creation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            } rounded-xl p-8 max-w-2xl w-full shadow-2xl transition duration-300`}>
              <h2 className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Create New Task
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={modalForm.text}
                  onChange={(e) => setModalForm({ ...modalForm, text: e.target.value })}
                  placeholder="Task name"
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
                <textarea
                  value={modalForm.notes}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  placeholder="Notes"
                  rows="3"
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={modalForm.priority}
                    onChange={(e) => setModalForm({ ...modalForm, priority: e.target.value })}
                    className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <select
                    value={modalForm.category}
                    onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="general">General</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="shopping">Shopping</option>
                    <option value="health">Health</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={modalForm.dueDate}
                    onChange={(e) => setModalForm({ ...modalForm, dueDate: e.target.value })}
                    className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  />
                  <select
                    value={modalForm.recurring}
                    onChange={(e) => setModalForm({ ...modalForm, recurring: e.target.value })}
                    className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="none">No Repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={modalForm.tags}
                  onChange={(e) => setModalForm({ ...modalForm, tags: e.target.value })}
                  placeholder="Tags (comma separated)"
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={addTask}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className={`flex-1 ${
                    theme === "dark"
                      ? "bg-gray-700 hover:bg-gray-600"
                      : "bg-gray-200 hover:bg-gray-300"
                  } font-semibold py-3 rounded-lg transition duration-200`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {columns.map((col) => (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-xl shadow-xl transition duration-300 min-h-[500px] p-4 ${
                      snapshot.isDraggingOver
                        ? `${
                            theme === "dark"
                              ? "bg-gray-700 ring-2 ring-offset-2 ring-offset-gray-900"
                              : "bg-gray-100 ring-2 ring-offset-2 ring-offset-gray-50"
                          } ring-blue-500`
                        : theme === "dark"
                        ? "bg-gray-800"
                        : "bg-gray-50"
                    } ${
                      theme === "dark" ? "border-gray-700" : "border-gray-200"
                    } border`}
                  >
                    {/* Column Header */}
                    <div className={`bg-gradient-to-r ${col.color} rounded-lg p-3 mb-4 text-white font-semibold flex items-center gap-2 shadow-lg`}>
                      <span className="text-xl">{col.icon}</span>
                      <span>{col.title}</span>
                      <span className="ml-auto bg-white/20 px-2 py-1 rounded text-sm">
                        {tasks.filter((task) => (task.status || "todo").toLowerCase() === col.id).length}
                      </span>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-3">
                      {tasks
                        .filter((task) => (task.status || "todo").toLowerCase() === col.id)
                        .map((task, index) => (
                          <Draggable
                            key={task._id}
                            draggableId={String(task._id)}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-4 rounded-lg border-l-4 transition duration-200 shadow-md ${
                                  task.completed
                                    ? "border-l-green-500 opacity-75"
                                    : isOverdue(task.dueDate)
                                    ? "border-l-red-500"
                                    : "border-l-blue-500"
                                } ${
                                  snapshot.isDragging
                                    ? "shadow-xl ring-2 ring-blue-500 scale-105"
                                    : "hover:shadow-lg hover:scale-102"
                                } ${
                                  theme === "dark"
                                    ? "bg-gradient-to-br from-gray-700 to-gray-800"
                                    : "bg-white"
                                }`}
                              >
                                {/* Priority Badge */}
                                <div className="flex items-start justify-between mb-2">
                                  <span className={`${getPriorityColor(
                                    task.priority || "medium"
                                  )} text-white text-xs px-2 py-1 rounded-full font-semibold`}>
                                    {(task.priority || "medium") === "high"
                                      ? "🔴"
                                      : (task.priority || "medium") === "medium"
                                      ? "🟡"
                                      : "🔵"}{" "}
                                    {(task.priority || "medium").toUpperCase()}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    theme === "dark"
                                      ? "bg-gray-600 text-gray-200"
                                      : "bg-gray-200 text-gray-700"
                                  }`}>
                                    {task.category || "general"}
                                  </span>
                                </div>

                                {/* Task Text */}
                                <p
                                  className={`font-medium mb-2 ${
                                    task.completed
                                      ? `line-through ${theme === "dark" ? "text-gray-400" : "text-gray-400"}`
                                      : theme === "dark"
                                      ? "text-white"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {task.text}
                                </p>

                                {/* Due Date */}
                                {task.dueDate && (
                                  <p
                                    className={`text-xs mb-2 ${
                                      isOverdue(task.dueDate)
                                        ? "text-red-500 font-semibold"
                                        : isToday(task.dueDate)
                                        ? "text-yellow-500 font-semibold"
                                        : theme === "dark"
                                        ? "text-gray-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    📅{" "}
                                    {isOverdue(task.dueDate)
                                      ? "Overdue"
                                      : isToday(task.dueDate)
                                      ? "Today"
                                      : new Date(task.dueDate).toLocaleDateString("en-US")}
                                  </p>
                                )}

                                {/* Tags */}
                                {task.tags && task.tags.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mb-2">
                                    {task.tags.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className={`text-xs px-2 py-1 rounded ${
                                          theme === "dark"
                                            ? "bg-purple-900/50 text-purple-300"
                                            : "bg-purple-100 text-purple-700"
                                        }`}
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Time Spent */}
                                {task.timeSpent > 0 && (
                                  <p className={`text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                                    ⏱️ {task.timeSpent} minutes
                                  </p>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => toggleTask(task._id)}
                                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-2 py-2 rounded text-xs font-semibold transition duration-200"
                                  >
                                    {task.completed ? "✓ Completed" : "Complete"}
                                  </button>
                                  <button
                                    onClick={() => deleteTask(task._id)}
                                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-2 rounded text-xs font-semibold transition duration-200"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                    </div>

                    {provided.placeholder}

                    {/* Empty State */}
                    {tasks.filter((task) => (task.status || "todo").toLowerCase() === col.id).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                        <span className="text-3xl mb-2">📭</span>
                        <p className="text-sm">No tasks yet</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

export default Home;
