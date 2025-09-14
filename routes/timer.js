const express = require('express');
const router = express.Router();
const { getTimerState, updateTimerState, getTimer } = require('../config/database');

// Initialize socket.io for the timer
module.exports = function(io) {
    const timerIo = io.of('/timer');

    // Utility: emit current state for a specific timer id
    async function emitCurrentState(socket, timerId) {
        try {
            const state = await new Promise((resolve, reject) => {
                getTimerState(timerId, (err, s) => {
                    if (err) return reject(err);
                    resolve(s);
                });
            });

            const isRunning = state.is_running === 1;
            const isPaused = state.is_paused === 1;
            const endTime = state.end_time;
            const timeLeft = state.time_left;

            if (isRunning && !isPaused) {
                const now = Date.now();
                const remainingTime = Math.max(0, Math.ceil((endTime - now) / 1000));

                if (remainingTime !== timeLeft) {
                    await new Promise((resolve, reject) => {
                        updateTimerState(timerId, {
                            is_running: isRunning,
                            is_paused: isPaused,
                            end_time: endTime,
                            hours: state.hours,
                            minutes: state.minutes,
                            seconds: state.seconds,
                            time_left: remainingTime
                        }, (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }

                socket.emit('timer:sync', {
                    isRunning: true,
                    isPaused: false,
                    timeLeft: remainingTime,
                    hours: state.hours,
                    minutes: state.minutes,
                    seconds: state.seconds,
                    endTime: endTime,
                    timerId
                });

                if (remainingTime <= 0) {
                    socket.emit('timer:complete');
                }
            } else if (isPaused) {
                socket.emit('timer:pause', {
                    timeLeft: state.time_left,
                    hours: state.hours,
                    minutes: state.minutes,
                    seconds: state.seconds,
                    timerId
                });
            } else {
                socket.emit('timer:reset', { timerId });
            }
        } catch (err) {
            console.error('Error getting timer state:', err);
            socket.emit('timer:reset', { timerId });
        }
    }
    
    timerIo.on('connection', (socket) => {
        console.log('New client connected to timer namespace');

        // Join a timer room
        socket.on('room:join', async ({ timerId }) => {
            if (!timerId) return;
            socket.join(`timer:${timerId}`);
            socket.data.timerId = timerId;
            await emitCurrentState(socket, timerId);
        });

        // Handle style update (font/color) – broadcast to room
        socket.on('style:update', (data = {}) => {
            const tId = data.timerId || socket.data.timerId;
            if (!tId) return;
            timerIo.to(`timer:${tId}`).emit('style:update', {
                timerId: tId,
                font_family: data.font_family,
                font_size: data.font_size,
                color_hex: data.color_hex
            });
        });
        
        // Handle timer start
        socket.on('timer:start', async (data) => {
            try {
                const timerId = data.timerId || socket.data.timerId;
                if (!timerId) return;
                const duration = data.hours * 3600 + data.minutes * 60 + data.seconds;
                const endTime = data.endTime;
                
                // Update the timer state in the database
                await new Promise((resolve, reject) => {
                    updateTimerState(timerId, {
                        is_running: 1,
                        is_paused: 0,
                        end_time: endTime,
                        hours: data.hours,
                        minutes: data.minutes,
                        seconds: data.seconds,
                        time_left: duration
                    }, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
                
                // Broadcast to all clients
                timerIo.to(`timer:${timerId}`).emit('timer:start', {
                    hours: data.hours,
                    minutes: data.minutes,
                    seconds: data.seconds,
                    endTime: endTime,
                    timerId
                });
                
                // Start the server-side timer to keep track of time
                startServerTimer(timerId);
            } catch (err) {
                console.error('Error starting timer:', err);
            }
        });
        
        // Handle timer pause
        socket.on('timer:pause', async (data) => {
            try {
                const timerId = data.timerId || socket.data.timerId;
                if (!timerId) return;
                const state = await new Promise((resolve, reject) => {
                    getTimerState(timerId, (err, state) => {
                        if (err) return reject(err);
                        resolve(state);
                    });
                });
                
                if (state.is_running && !state.is_paused) {
                    // Update the timer state in the database
                    await new Promise((resolve, reject) => {
                        updateTimerState(timerId, {
                            is_running: 0,
                            is_paused: 1,
                            end_time: state.end_time,
                            hours: state.hours,
                            minutes: state.minutes,
                            seconds: state.seconds,
                            time_left: data.timeLeft
                        }, (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                    
                    // Broadcast to all clients
                    timerIo.to(`timer:${timerId}`).emit('timer:pause', { 
                        timeLeft: data.timeLeft,
                        hours: state.hours,
                        minutes: state.minutes,
                        seconds: state.seconds,
                        timerId
                    });
                    
                    // Clear the server timer
                    if (global.timerInterval) {
                        clearInterval(global.timerInterval);
                        global.timerInterval = null;
                    }
                }
            } catch (err) {
                console.error('Error pausing timer:', err);
            }
        });
        
        // Handle timer reset
        socket.on('timer:reset', async (data = {}) => {
            try {
                const timerId = data.timerId || socket.data.timerId;
                if (!timerId) return;
                // Update the timer state in the database
                await new Promise((resolve, reject) => {
                    updateTimerState(timerId, {
                        is_running: 0,
                        is_paused: 0,
                        end_time: null,
                        hours: 0,
                        minutes: 5,
                        seconds: 0,
                        time_left: 0
                    }, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
                
                // Broadcast to all clients
                timerIo.to(`timer:${timerId}`).emit('timer:reset', { timerId });
                
                // Clear the server timer
                if (global.timerInterval) {
                    clearInterval(global.timerInterval);
                    global.timerInterval = null;
                }
            } catch (err) {
                console.error('Error resetting timer:', err);
            }
        });
        
        // Handle timer complete
        socket.on('timer:complete', async (data = {}) => {
            const timerId = data.timerId || socket.data.timerId;
            if (!timerId) return;
            timerIo.to(`timer:${timerId}`).emit('timer:complete', { timerId });
            // Clear the server timer
            if (global.timerInterval) {
                clearInterval(global.timerInterval);
                global.timerInterval = null;
            }
        });
        
        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('Client disconnected from timer namespace');
        });
    });
    
    // Function to start the server-side timer for a specific timer
    function startServerTimer(timerId) {
        if (global.timerInterval) {
            clearInterval(global.timerInterval);
        }
        
        global.timerInterval = setInterval(async () => {
            try {
                // Get current state from database
                const state = await new Promise((resolve, reject) => {
                    getTimerState(timerId, (err, state) => {
                        if (err) return reject(err);
                        resolve(state);
                    });
                });
                
                const isRunning = state.is_running === 1;
                const isPaused = state.is_paused === 1;
                const endTime = state.end_time;
                
                if (isRunning && !isPaused && endTime) {
                    const now = Date.now();
                    const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
                    
                    // Update time left in the database
                    await new Promise((resolve, reject) => {
                        updateTimerState(timerId, {
                            is_running: 1,
                            is_paused: 0,
                            end_time: endTime,
                            hours: state.hours,
                            minutes: state.minutes,
                            seconds: state.seconds,
                            time_left: timeLeft
                        }, (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                    
                    // Broadcast update to all clients
                    timerIo.to(`timer:${timerId}`).emit('timer:update', { 
                        timeLeft,
                        hours: state.hours,
                        minutes: state.minutes,
                        seconds: state.seconds,
                        timerId
                    });
                    
                    // Check if timer has completed
                    if (timeLeft <= 0) {
                        // Update database to mark timer as not running
                        await new Promise((resolve, reject) => {
                            updateTimerState(timerId, {
                                is_running: 0,
                                is_paused: 0,
                                end_time: null,
                                hours: state.hours,
                                minutes: state.minutes,
                                seconds: state.seconds,
                                time_left: 0
                            }, (err) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                        
                        timerIo.to(`timer:${timerId}`).emit('timer:complete', { timerId });
                        clearInterval(global.timerInterval);
                        global.timerInterval = null;
                    }
                }
            } catch (err) {
                console.error('Error in server timer:', err);
                // If there's an error, stop the timer to prevent further errors
                if (global.timerInterval) {
                    clearInterval(global.timerInterval);
                    global.timerInterval = null;
                }
            }
        }, 1000); // Update every second to reduce database load
    }
    
    return router;
};
