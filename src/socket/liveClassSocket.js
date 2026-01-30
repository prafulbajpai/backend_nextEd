/**
 * Live Class WebRTC signaling over Socket.IO
 * Map: classId -> teacherSocketId
 */

const liveClassTeachers = new Map();

function liveClassSocket(io) {
  io.on("connection", (socket) => {
    console.log("LiveClass Socket:", socket.id);

    // ---------------------------
    // TEACHER STARTS CLASS
    // ---------------------------
    socket.on("startLiveClass", ({ classId }) => {
      if (!classId) return;

      // Prevent multiple teachers in same class
      if (liveClassTeachers.has(classId)) {
        socket.emit("errorMessage", {
          message: "Class already live"
        });
        return;
      }

      liveClassTeachers.set(classId, socket.id);
      socket.join(classId);

      console.log(`Class ${classId} is LIVE`);

      socket.emit("liveClassStarted", { classId });
    });

    // ---------------------------
    // STUDENT JOINS CLASS
    // ---------------------------
    socket.on("joinLiveClass", ({ classId }) => {
      if (!classId) return;

      socket.join(classId);

      const teacherSocketId = liveClassTeachers.get(classId);

      if (teacherSocketId) {
        io.to(teacherSocketId).emit("studentJoined", {
          classId,
          studentSocketId: socket.id
        });
      } else {
        socket.emit("errorMessage", {
          message: "Class not live"
        });
      }
    });

    // ---------------------------
    // OFFER (Teacher → Student)
    // ---------------------------
    socket.on("offer", ({ toSocketId, classId, sdp }) => {
      if (!toSocketId || !sdp) return;

      io.to(toSocketId).emit("offer", {
        fromSocketId: socket.id,
        classId,
        sdp
      });
    });

    // ---------------------------
    // ANSWER (Student → Teacher)
    // ---------------------------
    socket.on("answer", ({ toSocketId, classId, sdp }) => {
      if (!toSocketId || !sdp) return;

      io.to(toSocketId).emit("answer", {
        fromSocketId: socket.id,
        classId,
        sdp
      });
    });

    // ---------------------------
    // ICE CANDIDATE (Both sides)
    // ---------------------------
    socket.on("iceCandidate", ({ toSocketId, classId, candidate }) => {
      if (!toSocketId || !candidate) return;

      io.to(toSocketId).emit("iceCandidate", {
        fromSocketId: socket.id,
        classId,
        candidate
      });
    });

    // ---------------------------
    // TEACHER ENDS CLASS
    // ---------------------------
    socket.on("endLiveClass", ({ classId }) => {
      if (!classId) return;

      if (liveClassTeachers.get(classId) === socket.id) {
        liveClassTeachers.delete(classId);
        io.to(classId).emit("liveClassEnded", { classId });
        console.log(`Class ${classId} ended`);
      }
    });

    // ---------------------------
    // CLEANUP ON DISCONNECT
    // ---------------------------
    socket.on("disconnect", () => {
      for (const [classId, teacherId] of liveClassTeachers.entries()) {
        if (teacherId === socket.id) {
          liveClassTeachers.delete(classId);
          io.to(classId).emit("liveClassEnded", { classId });
          console.log(`Teacher disconnected, class ${classId} ended`);
          break;
        }
      }
    });
  });
}

module.exports = liveClassSocket;
