import numpy as np
import wave
import struct

sample_rate = 44100
duration = 2.2

# Generate time array
t = np.linspace(0, duration, int(sample_rate * duration), False)

# Stepper motor sound (a square/saw wave around 600Hz that slightly fluctuates)
# To make it sound like a thermal printer, it's a rapid staccato
motor_freq = 800
motor = np.sign(np.sin(2 * np.pi * motor_freq * t)) * 0.3

# The print head scratching (white noise filtered)
noise = np.random.uniform(-1, 1, len(t)) * 0.4

# Amplitude envelope (stuttering)
# Thermal printers print a row, stop, print a row...
stutter_freq = 15 # 15 rows per second
envelope = (np.sign(np.sin(2 * np.pi * stutter_freq * t)) + 1) / 2
# Smooth the envelope slightly
smooth_env = np.convolve(envelope, np.ones(100)/100, mode='same')

audio = (motor + noise) * smooth_env * 0.5
audio = audio * 32767 / np.max(np.abs(audio))
audio = audio.astype(np.int16)

with wave.open('public/printer.wav', 'w') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    for sample in audio:
        wav_file.writeframes(struct.pack('h', sample))

print("Sound generated successfully.")
