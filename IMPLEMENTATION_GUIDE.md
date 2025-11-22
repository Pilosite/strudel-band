# Multi-Agent Music Jam System - Implementation Guide for Claude Code

## 🎯 Project Vision

Build a collaborative AI music system where multiple specialized AI agents act as virtual musicians, each controlling an instrument in a Strudel (TidalCycles) live coding environment. Agents listen to each other and adapt in real-time based on natural language instructions.

## 🎵 Core Concept

Think of it as **AI4Ops but for music** - autonomous agents with specialized roles collaborating to achieve a shared goal (creating music), with self-adaptation and inter-agent communication.

### The Band Members (Agents)

1. **🥁 DRUMS** - Rhythm and groove specialist
   - Samples: bd, sn, hh, cp, rim, tom, crash, ride
   - Specialty: Rhythmic patterns, breaks, fills

2. **🎸 BASS** - Harmonic foundation and groove
   - Synths: bass, sawtooth, square, triangle
   - Specialty: Bass lines, sub-bass, deep grooves

3. **🎹 LEAD** - Melodies and hooks
   - Synths: piano, sawtooth, square, sine
   - Specialty: Arpeggios, melodies, solos

4. **🌊 PADS** - Atmosphere and texture
   - Synths: sawtooth, sine, strings
   - Specialty: Pads, ambiences, long textures

5. **✨ FX** - Sonic color and surprises
   - Samples: noise, various samples, percussion
   - Specialty: Textures, glitches, experimental elements

## 🏗️ System Architecture

### Current State (Prototype)
- HTML/JS interface with Strudel.js embedded
- Claude API integration for code generation
- Each agent generates Strudel patterns via prompts
- Ableton-style compact UI (all visible in one window)

### Target State (Production)
```
┌─────────────────────────────────────────────────────┐
│  User Interface (Browser/Desktop)                   │
│  ├─ Transport Controls (Play/Stop/Tempo)            │
│  ├─ Director Panel (Global instructions)            │
│  └─ Track Views (5 agents × controls)               │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│  Agent Orchestration Layer                          │
│  ├─ Band Director (coordinates global instructions) │
│  ├─ Agent Manager (spawns/manages agents)           │
│  └─ Context Broker (shares state between agents)    │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│  Individual Agents (Claude API instances)           │
│  ├─ Agent Profile (role, samples, specialty)        │
│  ├─ Context (other agents' patterns)                │
│  ├─ Code Generator (Strudel pattern creation)       │
│  └─ State (current pattern, mute, active)           │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│  Audio Engine (Strudel.js)                          │
│  ├─ Pattern Evaluation                              │
│  ├─ Audio Synthesis (WebAudio API)                  │
│  └─ Output → Speakers                               │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│  Audio Streaming Layer (FUTURE)                     │
│  ├─ Audio Capture (WebAudio → buffer)               │
│  ├─ Claude Audio API (agents "hear" the mix)        │
│  └─ Real-time Adaptation (agents respond to audio)  │
└─────────────────────────────────────────────────────┘
```

## 🎮 User Interaction Flow

### Scenario 1: Global Direction
```
User: "Everyone, let's do a funky passage!"
  ↓
Band Director Agent analyzes instruction
  ↓
Generates specific instructions for each agent:
  - Drums: "Funky breakbeat with ghost notes"
  - Bass: "Syncopated funk bass line with slides"
  - Lead: "Staccato chords on the upbeat"
  - Pads: "Subtle sustained chords for space"
  - FX: "Occasional wah-like filter sweeps"
  ↓
Each agent generates Strudel code independently
  ↓
Patterns are combined in stack() and played
```

### Scenario 2: Individual Instruction
```
User: "Bass player, give us a dubby groove!"
  ↓
Bass Agent receives instruction
  ↓
Bass Agent considers context:
  - What tempo are drums playing?
  - What's the current vibe?
  - What key are other melodic elements in?
  ↓
Generates adapted Strudel pattern
  ↓
Pattern replaces current bass pattern
  ↓
Auto-play or manual trigger
```

### Scenario 3: Reactive Jamming (FUTURE with audio streaming)
```
Agents continuously listen to audio output
  ↓
Audio analysis extracts features:
  - Tempo/BPM
  - Key/tonality
  - Intensity/energy level
  - Rhythmic density
  ↓
Agents autonomously adapt:
  - Drums detect energy drop → add fills
  - Bass detects key change → modulate
  - Lead detects space → add melodic line
  - Pads detect intensity → adjust filtering
```

## 💻 Technical Implementation

### Phase 1: Core Foundation (CURRENT)
✅ Basic UI with Ableton-style layout
✅ Claude API integration for code generation
✅ Agent profiles and specializations
✅ Individual and group instruction handling
✅ Mute/solo/clear controls per track
✅ Timeline visualization (basic)

### Phase 2: Enhanced Agent Intelligence
🔲 **Agent Context Awareness**
   - Pass other agents' patterns as context
   - Agents analyze and adapt to existing patterns
   - Musical coherence (key, tempo, rhythm alignment)

🔲 **Pattern Memory System**
   - Store pattern history per agent
   - "Go back to previous pattern"
   - "Remember this as variation A/B/C"
   - Export/import sessions

🔲 **Improved Timeline Visualization**
   - Parse Strudel code to extract actual pattern
   - Visual grid showing hits/notes over time
   - Color-coded intensity
   - Waveform preview (if possible)

### Phase 3: Audio Streaming & Real-Time Adaptation
🔲 **Audio Capture Pipeline**
   ```javascript
   WebAudio API → Audio Buffer → Base64 Encoding
     ↓
   Claude API with audio input
     ↓
   Analysis: tempo, key, intensity, texture
     ↓
   Agent decision: adapt, maintain, or rest
   ```

🔲 **Autonomous Agent Behavior**
   - Agents can spontaneously generate new patterns
   - "Listening mode" where agents wait for the right moment
   - Call-and-response patterns between agents
   - Agents can request changes from other agents

🔲 **Real-Time Mixing Controls**
   - Per-track volume/gain
   - EQ controls (low/mid/high)
   - Effects routing (reverb, delay shared)
   - Master bus processing

### Phase 4: Advanced Features
🔲 **Agent Personality & Learning**
   - Each agent has a "style" parameter
   - Conservative vs. experimental
   - Agents learn user preferences over sessions
   - "This drummer always does fills on bar 4"

🔲 **Multi-User Collaboration**
   - Multiple human users can direct different agents
   - Shared session state via WebSocket
   - Live collaboration jam sessions

🔲 **Export & Integration**
   - Export to MIDI
   - Export to Ableton Live Set
   - Render to audio file
   - Share sessions via URL

## 🔧 Technical Stack

### Frontend
- **HTML/CSS/JS** - Core interface
- **Strudel.js** - Live coding engine (TidalCycles in browser)
- **WebAudio API** - Audio synthesis and capture
- **Canvas/SVG** - Visualizations

### Backend/API
- **Claude API** (Sonnet 4.5) - Agent intelligence
  - Text generation for pattern code
  - Audio input (future) for listening
- **Optional Backend**:
  - Node.js/Express for session management
  - WebSocket for real-time collaboration
  - Database for pattern storage

### Key Libraries
- `@strudel/embed` - Strudel integration
- Native Fetch API - Claude API calls
- No heavy frameworks - keep it lean

## 📋 Implementation Steps for Claude Code

### Step 1: Project Setup
```bash
mkdir multi-agent-jam
cd multi-agent-jam
# Use the provided HTML template as starting point
```

### Step 2: Code Organization
```
multi-agent-jam/
├── index.html              # Main UI (use provided template)
├── css/
│   └── style.css           # Extracted styles
├── js/
│   ├── agents.js           # Agent management & profiles
│   ├── api.js              # Claude API wrapper
│   ├── strudel.js          # Strudel pattern handling
│   ├── ui.js               # UI interactions
│   └── main.js             # App initialization
├── config.js               # Configuration (API, defaults)
└── README.md               # Project documentation
```

### Step 3: Core Refactoring
- Extract CSS from inline to `style.css`
- Modularize JavaScript into separate files
- Create proper classes for Agent, Track, Director
- Implement event system for agent communication

### Step 4: Enhanced Features
- Improve pattern parsing for better timeline viz
- Add real context passing between agents
- Implement pattern history/undo
- Add keyboard shortcuts (see list below)

### Step 5: Testing & Polish
- Test all agent combinations
- Ensure musical coherence
- Optimize API call efficiency
- Add error handling and user feedback

## ⌨️ Keyboard Shortcuts (to implement)

```
Global:
  Ctrl/Cmd + Enter  → Play all
  Ctrl/Cmd + .      → Stop all
  Space             → Play/Pause toggle
  Ctrl/Cmd + R      → Regenerate current track
  Ctrl/Cmd + D      → Direct band (focus director prompt)

Per Track (when focused):
  M                 → Mute/unmute
  S                 → Solo
  G                 → Generate pattern
  C                 → Clear pattern
  1-5               → Focus track 1-5
  Shift + Enter     → Generate and auto-play

Director:
  Ctrl/Cmd + 1-6    → Load quick preset 1-6
```

## 🎨 Design Principles

1. **Minimal and Functional** - Ableton-style efficiency
2. **All visible at once** - No scrolling, everything fits
3. **Clear visual hierarchy** - Color coding per agent
4. **Immediate feedback** - Status indicators, loading states
5. **Keyboard-first** - Power users should rarely need mouse

## 🚀 Future Vision

### The Ultimate Goal
A system where you can say:
- "Start a downtempo jam session"
- "Bass player, drop out for 8 bars"
- "Everyone build intensity for 32 bars then drop hard"
- "Lead, respond to what the bass just did"

And the agents understand, coordinate, and execute musically coherent results while listening to the actual audio output and adapting in real-time.

### Research Applications
This could become a testbed for:
- Multi-agent coordination algorithms
- Creative AI systems
- Real-time audio analysis and generation
- Human-AI collaborative creativity

## 📚 Key Resources

### Strudel Documentation
- https://strudel.cc/
- https://github.com/tidalcycles/strudel
- Strudel API reference for pattern syntax

### Claude API
- https://docs.anthropic.com/
- Audio API documentation (for future audio streaming)
- Best practices for agent prompting

### Audio Processing
- WebAudio API documentation
- Real-time audio analysis techniques
- BPM/key detection algorithms

## 🎯 Success Metrics

A successful implementation will:
1. ✅ Generate musically coherent patterns consistently
2. ✅ Agents adapt to each other's patterns naturally
3. ✅ UI is responsive and intuitive
4. ✅ No audio glitches or timing issues
5. ✅ Users can create a full track in under 5 minutes
6. 🔲 (Future) Agents respond to audio in real-time
7. 🔲 (Future) Sessions can be saved/loaded/shared

## 💡 Tips for Implementation

1. **Start Simple** - Get one agent working perfectly first
2. **Musical First** - Prioritize musical quality over features
3. **Context is Key** - Agents need good context to adapt well
4. **Prompt Engineering** - Spend time crafting agent prompts
5. **Error Handling** - Music should never crash, graceful fallbacks
6. **Performance** - Watch for latency in API calls
7. **Test with Music** - Actually jam with it regularly

## 🎵 Example Use Case

**User wants to create ambient trip-hop:**

```
1. User clicks "Ambient Session" quick preset
   → Director instructs all agents with ambient guidelines

2. Drums generate: sparse, loose breaks with rim shots
3. Bass generates: deep, dubby sub-bass with space
4. Lead generates: minimal melodic fragments with delay
5. Pads generate: wide atmospheric textures
6. FX generates: vinyl crackle and occasional glitches

7. User: "Bass player, make it more dubby with filter sweeps"
   → Bass agent regenerates with LPF modulation

8. User: "Everyone gradually build intensity"
   → Director coordinates progressive intensification
   → Drums: add more hi-hats
   → Bass: add movement
   → Lead: increase note density
   → Pads: brighter filtering
   → FX: more activity

9. Result: A coherent ambient trip-hop track that evolved naturally
```

---

## 🔥 Ready to Build?

This guide provides the full context for creating a production-ready multi-agent music system. The provided HTML template is a solid foundation - now it's time to modularize, enhance, and make it bulletproof.

**First steps:**
1. Extract and organize the code
2. Implement proper agent context passing
3. Enhance timeline visualization
4. Add keyboard shortcuts
5. Test extensively with real jamming

Let's create the future of AI-assisted music creation! 🎵🤖
