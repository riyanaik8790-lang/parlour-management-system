# Capstone Project Architecture

This document explains how our project is built. It is split into two main parts: the Artificial Intelligence (AI) for analyzing images, and the Information Practices (IP) for our website and database.

## 1. The AI Component (Computer Vision)

Our main AI feature is the **AI Skin-Tone & Colour Advisor**. It uses a camera to look at a user's face and recommend the perfect makeup colors. Here is how it works:

- **Finding the Face (ROI Extraction)**:
  - We use **Python**, **OpenCV**, and facial detection tools like **Haar Cascades** and **MediaPipe**.
  - These tools scan the image to find the face and isolate the skin (the Region of Interest or ROI). This cuts out the background so we only analyze actual skin pixels.
- **Handling Bad Lighting (RGB to LAB Color Space)**:
  - Normal cameras capture colors in RGB (Red, Green, Blue). We convert these RGB pixels into the **LAB Color Space**.
  - This is crucial because LAB separates the **Luminance (L)** (how bright the light is) from the actual colors (A and B). By removing the brightness factor, we can accurately find the user's true skin undertone even if they are standing in bad or uneven lighting.
- **Recommending Makeup (Heuristic Mapping Engine)**:
  - Once we know the true skin undertone, our **heuristic mapping engine** takes over.
  - It matches the user's exact skin color to our database and outputs specific **cosmetic hex codes** (like `#F5D0C5`), giving the user a personalized makeup color match.

## 2. The IP Component (Web & Database Architecture)

The web side of our project is designed to be fast, secure, and handle multiple users at once.

- **Preventing Double-Booking (Database Concurrency Control)**:
  - We built a smart booking engine where users can schedule appointments.
  - To make sure two people don't book the exact same time slot, we use **Database Concurrency Control** in **Supabase**. This locks the time slot while a booking is happening, completely preventing double-booking errors.
- **Automated Reminders (Cron Jobs & Push Notifications)**:
  - We use background tasks called **Cron Jobs** that run automatically every single minute.
  - These jobs check the database for upcoming appointments and automatically trigger **Web Push Notifications** to remind users, without needing any manual work.
- **Secure Web Architecture (React, Node/Flask, JWT)**:
  - **Frontend**: We use **React** to build a smooth, interactive user interface.
  - **Backend**: We use a mix of **Node.js** and **Flask** to handle the web requests and run the AI scripts.
  - **Security**: We use **JSON Web Tokens (JWT)** to keep users logged in securely. JWT also ensures that only users with the "Admin" role can access the admin dashboard.
