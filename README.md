# Stream Timer

> Built as part of a training session to showcase the power of agentic AI in building complete platforms.
> 
> Inspiration taken from [obscountdown.com](https://dashboard.obscountdown.com/)

A real-time collaborative countdown timer for streaming applications, built with Node.js, Express, and Socket.IO.

## Features

- Set countdown duration in hours, minutes, and seconds
- Real-time synchronization across multiple clients
- Start, pause, and reset functionality
- Auto-restart option
- Responsive design that works on all devices
- WebSocket-based communication for instant updates
- No database required (in-memory state)

## Prerequisites

- Node.js (v14 or later)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd web-timer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (optional):
   ```
   PORT=3000
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
This will start the server with nodemon for automatic reloading.

### Production Mode
```bash
npm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Set your desired countdown time using the input fields
3. Click "Start" to begin the countdown
4. Use "Pause" to pause the timer and "Reset" to reset it
5. Enable "Auto-restart" to have the timer automatically restart when it reaches zero

## Deployment

### Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following build command:
   ```
   npm install
   ```
4. Set the start command:
   ```
   npm start
   ```
5. Add any necessary environment variables in the Render dashboard
6. Deploy!

## Browser Source for OBS

To add the timer to OBS as a browser source:

1. In OBS, add a new Browser Source
2. Enter the URL where your timer is hosted (e.g., `http://your-domain.com`)
3. Set the width to 1920 and height to 200 (adjust as needed)
4. Check "Shutdown source when not visible"
5. Click OK

## Customization

You can customize the appearance by modifying the CSS in `public/css/style.css`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
