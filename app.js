const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");
const app = express();
const PORT = 3000;
const path = require("path");
const cors = require("cors");

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login.html");
}

function requireStudentLogin(req, res, next) {
  if (req.session.user && req.session.user.role === "student") {
    return next();
  }
  res.redirect("/login.html");
}

function requireAdminLogin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  res.redirect("/login.html");
}

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Users WHERE username = ?", [
      username,
    ]);
    if (rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.user = { id: user.id, role: user.role };

        if (user.role === "student") {
          res.json({
            message: "로그인 성공",
            redirectUrl: "/student-dashboard.html",
          });
        } else if (user.role === "admin") {
          res.json({
            message: "로그인 성공",
            redirectUrl: "/admin-dashboard.html",
          });
        } else {
          res.status(403).send("알 수 없는 역할입니다.");
        }
      } else {
        res.status(401).send("비밀번호가 일치하지 않습니다.");
      }
    } else {
      res.status(404).send("사용자를 찾을 수 없습니다.");
    }
  } catch (err) {
    console.error("로그인 처리 중 오류:", err);
    res.status(500).send("서버 에러");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("로그아웃 중 오류:", err);
      return res.status(500).send("로그아웃 실패");
    }
    res.send("로그아웃 성공");
  });
});

app.delete("/courses/:id", requireAdminLogin, async (req, res) => {
  const courseId = req.params.id;

  try {
    await db.query("DELETE FROM Enrollments WHERE course_id = ?", [courseId]);
    const [result] = await db.query("DELETE FROM Courses WHERE id = ?", [
      courseId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).send("삭제할 강의를 찾을 수 없습니다.");
    }

    res.send("강의가 삭제되었습니다.");
  } catch (err) {
    console.error("강의 삭제 중 오류:", err);
    res.status(500).send("강의 삭제 중 오류가 발생했습니다.");
  }
});

app.post("/courses", requireAdminLogin, async (req, res) => {
  const { name, professor, credits, maxStudents, schedule } = req.body;

  if (!name || !professor || !credits || !maxStudents || !schedule) {
    return res.status(400).send("모든 필드를 채워주세요.");
  }

  try {
    const serializedSchedule = JSON.stringify(schedule);
    await db.query(
      "INSERT INTO Courses (name, professor, credits, max_students, schedule) VALUES (?, ?, ?, ?, ?)",
      [name, professor, credits, maxStudents, serializedSchedule]
    );
    res.send("강의가 추가되었습니다.");
  } catch (err) {
    console.error("강의 추가 중 오류:", err);
    res.status(500).send("강의 추가 중 오류가 발생했습니다.");
  }
});

app.post("/add-student", requireAdminLogin, async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).send("학생 이름을 입력해야 합니다.");
  }

  const defaultPassword = "1234";

  try {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    await db.query(
      "INSERT INTO Users (username, password, role) VALUES (?, ?, 'student')",
      [username, hashedPassword]
    );
    res.send("학생이 추가되었습니다.");
  } catch (err) {
    console.error("학생 추가 중 오류:", err);
    res.status(500).send("학생 추가 중 오류가 발생했습니다.");
  }
});

app.get("/student-dashboard.html", requireStudentLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/student-dashboard.html"));
});

app.get("/admin-dashboard.html", requireAdminLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin-dashboard.html"));
});

app.get("/available-courses/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = await db.query(
      `SELECT Courses.*
       FROM Courses
       WHERE Courses.id NOT IN (
           SELECT course_id FROM Enrollments WHERE user_id = ?
       )`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("신청 가능한 강의 목록 가져오는 중 오류:", err);
    res
      .status(500)
      .send("신청 가능한 강의 목록 가져오는 중 오류가 발생했습니다.");
  }
});

app.get("/my-courses", requireStudentLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT Courses.id, Courses.name, Courses.professor, Courses.credits, Courses.schedule
       FROM Enrollments
       JOIN Courses ON Enrollments.course_id = Courses.id
       WHERE Enrollments.user_id = ?`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("신청한 강의 목록을 가져오는 중 오류:", err);
    res.status(500).send("신청한 강의 목록을 가져오는 중 오류가 발생했습니다.");
  }
});

app.get("/students", requireAdminLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username FROM Users WHERE role = 'student'"
    );
    res.json(rows);
  } catch (err) {
    console.error("학생 목록 가져오기 중 오류:", err);
    res.status(500).send("학생 목록 가져오기 중 오류가 발생했습니다.");
  }
});

app.get("/courses", requireAdminLogin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Courses");
    res.json(rows);
  } catch (err) {
    console.error("강의 목록 가져오기 중 오류:", err);
    res.status(500).send("강의 목록 가져오기 중 오류가 발생했습니다.");
  }
});
app.get("/check-session", (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).send("로그인이 필요합니다.");
  }
});
app.post("/enroll", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("로그인이 필요합니다.");
  }

  const userId = req.session.user.id;
  const { courseId } = req.body;

  try {
    const [newCourse] = await db.query("SELECT * FROM Courses WHERE id = ?", [
      courseId,
    ]);
    if (newCourse.length === 0) {
      return res.status(404).send("강의를 찾을 수 없습니다.");
    }

    const newSchedule =
      typeof newCourse[0].schedule === "string"
        ? JSON.parse(newCourse[0].schedule)
        : newCourse[0].schedule;

    const [enrolledCourses] = await db.query(
      `SELECT Courses.schedule 
       FROM Enrollments
       JOIN Courses ON Enrollments.course_id = Courses.id
       WHERE Enrollments.user_id = ?`,
      [userId]
    );

    for (const enrolled of enrolledCourses) {
      const enrolledSchedule =
        typeof enrolled.schedule === "string"
          ? JSON.parse(enrolled.schedule)
          : enrolled.schedule;

      for (const enrolledTime of enrolledSchedule) {
        for (const newTime of newSchedule) {
          if (
            enrolledTime.day === newTime.day &&
            !(
              newTime.end <= enrolledTime.start ||
              newTime.start >= enrolledTime.end
            )
          ) {
            return res
              .status(400)
              .send("이미 신청한 강의와 시간이 중복됩니다.");
          }
        }
      }
    }

    await db.query(
      "INSERT INTO Enrollments (user_id, course_id) VALUES (?, ?)",
      [userId, courseId]
    );
    res.send("수강 신청이 완료되었습니다.");
  } catch (err) {
    console.error("수강 신청 중 오류:", err);
    res.status(500).send("수강 신청 중 오류가 발생했습니다.");
  }
});

app.delete("/courses/:id", requireAdminLogin, async (req, res) => {
  const courseId = req.params.id;

  try {
    await db.query("DELETE FROM Enrollments WHERE course_id = ?", [courseId]);

    const [result] = await db.query("DELETE FROM Courses WHERE id = ?", [
      courseId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).send("삭제할 강의를 찾을 수 없습니다.");
    }

    res.send("강의가 삭제되었습니다.");
  } catch (err) {
    console.error("강의 삭제 중 오류:", err);
    res.status(500).send("강의 삭제 중 오류가 발생했습니다.");
  }
});

app.delete(
  "/remove-student/:studentId",
  requireAdminLogin,
  async (req, res) => {
    const studentId = req.params.studentId;

    try {
      await db.query("DELETE FROM Enrollments WHERE user_id = ?", [studentId]);

      const [result] = await db.query("DELETE FROM Users WHERE id = ?", [
        studentId,
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).send("삭제할 학생을 찾을 수 없습니다.");
      }

      res.send("학생이 삭제되었습니다.");
    } catch (err) {
      console.error("학생 삭제 중 오류:", err);
      res.status(500).send("학생 삭제 중 오류가 발생했습니다.");
    }
  }
);
app.delete("/enroll", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("로그인이 필요합니다.");
  }

  const userId = req.session.user.id;
  const { courseId } = req.body;

  if (!courseId) {
    console.error("courseId가 누락됨");
    return res.status(400).send("courseId가 필요합니다.");
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM Enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );

    if (rows.length === 0) {
      console.error("신청 내역이 없습니다.");
      return res.status(404).send("신청 내역이 없습니다.");
    }

    await db.query(
      "DELETE FROM Enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );

    res.send("수강 신청이 취소되었습니다.");
  } catch (err) {
    console.error("수강 신청 취소 중 오류:", err);
    res.status(500).send("수강 신청 취소 중 오류가 발생했습니다.");
  }
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
