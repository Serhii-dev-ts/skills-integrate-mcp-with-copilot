document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const authButton = document.getElementById("auth-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLogin = document.getElementById("cancel-login");
  const loginRequired = document.getElementById("login-required");

  let authToken = localStorage.getItem("activityAppToken");
  let currentTeacher = localStorage.getItem("activityAppTeacher");

  function updateAuthUI() {
    const loggedIn = Boolean(authToken && currentTeacher);
    authStatus.textContent = loggedIn
      ? `Logged in as ${currentTeacher}`
      : "Not logged in";
    authButton.textContent = loggedIn ? "Logout" : "Login";
    loginRequired.classList.toggle("hidden", loggedIn);
    signupForm.querySelector("button[type='submit']").disabled = !loggedIn;
  }

  function setAuthState(token, teacher) {
    authToken = token;
    currentTeacher = teacher;
    localStorage.setItem("activityAppToken", token);
    localStorage.setItem("activityAppTeacher", teacher);
    updateAuthUI();
  }

  function clearAuthState() {
    authToken = null;
    currentTeacher = null;
    localStorage.removeItem("activityAppToken");
    localStorage.removeItem("activityAppTeacher");
    updateAuthUI();
  }

  function getAuthHeaders() {
    return authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {};
  }

  function toggleLoginModal(show) {
    loginModal.classList.toggle("hidden", !show);
  }

  async function loginTeacher(username, password) {
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Login failed");
      }

      setAuthState(result.token, result.username);
      messageDiv.textContent = `Welcome, ${result.username}. You can now register students.`;
      messageDiv.className = "success";
      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
      fetchActivities();
    } catch (error) {
      messageDiv.textContent = error.message || "Login failed";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Login error:", error);
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=''>-- Select an activity --</option>";

      const isTeacher = Boolean(authToken && currentTeacher);

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsItems = details.participants.length
          ? details.participants
              .map((email) => {
                if (isTeacher) {
                  return `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`;
                }
                return `<li><span class="participant-email">${email}</span></li>`;
              })
              .join("")
          : "";

        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${participantsItems}
                </ul>
             </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearAuthState();
          messageDiv.textContent = "Session expired. Please log in again.";
        } else {
          messageDiv.textContent = result.detail || "An error occurred";
        }
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearAuthState();
          messageDiv.textContent = "Teacher login required to register students.";
        } else {
          messageDiv.textContent = result.detail || "An error occurred";
        }
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  authButton.addEventListener("click", () => {
    if (authToken && currentTeacher) {
      fetch("/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      }).finally(() => {
        clearAuthState();
        messageDiv.textContent = "Logged out.";
        messageDiv.className = "info";
        messageDiv.classList.remove("hidden");
        setTimeout(() => {
          messageDiv.classList.add("hidden");
        }, 5000);
      });
      return;
    }
    toggleLoginModal(true);
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;
    loginTeacher(username, password);
    toggleLoginModal(false);
  });

  cancelLogin.addEventListener("click", () => {
    toggleLoginModal(false);
  });

  updateAuthUI();
  fetchActivities();
});
