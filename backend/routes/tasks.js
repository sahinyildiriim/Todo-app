const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const authMiddleware = require("../middleware/authMiddleware");

// ------------------------------------------
// 1) Add Task
// ------------------------------------------
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { text, priority, dueDate, category, notes, recurring, tags } =
      req.body;

    if (!text) {
      return res.status(400).json({ message: "Task text is required" });
    }

    const newTask = new Task({
      user: req.user.id,
      text,
      priority: priority || "medium",
      dueDate: dueDate || null,
      category: category || "general",
      notes: notes || "",
      recurring: recurring || "none",
      tags: tags || [],
    });

    await newTask.save();

    res.json({ message: "Task added", task: newTask });
  } catch (error) {
    console.error("Task add error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 2) List All User Tasks
// ------------------------------------------
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.json(tasks);
  } catch (error) {
    console.error("Task list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 3) Toggle Task Completion
// ------------------------------------------
router.put("/toggle/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.completed = !task.completed;
    await task.save();

    res.json({ message: "Updated", task });
  } catch (error) {
    console.error("Toggle error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 4) Update Task Status
// ------------------------------------------
router.put("/update-status/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !["todo", "inprogress", "done"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.status = status;
    await task.save();

    res.json({ message: "Status updated", task });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 5) Delete Task
// ------------------------------------------
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 6) Update Task Details
// ------------------------------------------
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    const { text, priority, dueDate, category, notes, recurring, tags } =
      req.body;
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (text) task.text = text;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (category) task.category = category;
    if (notes) task.notes = notes;
    if (recurring) task.recurring = recurring;
    if (tags) task.tags = tags;

    await task.save();
    res.json({ message: "Task updated", task });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 7) Task Statistics
// ------------------------------------------
router.get("/stats/overview", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id });

    const stats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      inProgress: tasks.filter((t) => t.status === "inprogress").length,
      todo: tasks.filter((t) => t.status === "todo").length,
      byPriority: {
        high: tasks.filter((t) => t.priority === "high").length,
        medium: tasks.filter((t) => t.priority === "medium").length,
        low: tasks.filter((t) => t.priority === "low").length,
      },
      byCategory: {},
      completionRate:
        tasks.length > 0
          ? (
              (tasks.filter((t) => t.completed).length / tasks.length) *
              100
            ).toFixed(2)
          : 0,
      overdue: tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed
      ).length,
      dueSoon: tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) > new Date() &&
          new Date(t.dueDate) <
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
          !t.completed
      ).length,
    };

    // Count by category
    tasks.forEach((task) => {
      stats.byCategory[task.category] =
        (stats.byCategory[task.category] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 8) Get Categories List
// ------------------------------------------
router.get("/categories/list", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id });
    const categories = [...new Set(tasks.map((t) => t.category))];
    res.json(categories);
  } catch (error) {
    console.error("Categories error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 9) Search and Filter Tasks
// ------------------------------------------
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const { query, priority, category, status, sortBy } = req.query;
    let filter = { user: req.user.id };

    if (query) {
      filter.$or = [
        { text: { $regex: query, $options: "i" } },
        { notes: { $regex: query, $options: "i" } },
        { tags: { $in: [query] } },
      ];
    }

    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (status) filter.status = status;

    let tasks = await Task.find(filter);

    // Sorting
    if (sortBy === "dueDate") {
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (sortBy === "priority") {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      tasks.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    }

    res.json(tasks);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// 10) Track Time
// ------------------------------------------
router.put("/track-time/:id", authMiddleware, async (req, res) => {
  try {
    const { minutes } = req.body;
    const task = await Task.findOne({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.timeSpent = (task.timeSpent || 0) + minutes;
    await task.save();

    res.json({ message: "Time tracked", task });
  } catch (error) {
    console.error("Time track error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
