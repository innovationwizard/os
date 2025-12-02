# Project Intent: OCD

> **Purpose:** This document clarifies the strategic intent, core purpose, and fundamental design decisions of the OCD project.

---

## Project Concepts

### Gigr

**Main Concept:**

The mission of this project is to get me gigs. 

AI gigs or AI related gigs are strongly preferred. 

As a full stack dev, web app developments that don't require AI and other programming developments that don't require AI are also allowed. 

Underlying the mission is the laser-focused purpose of turning my expertise and my skills into a money-making-machine, as much as possible, and as fast as possible.

---

## Strategic Questions

### 1. What is the fundamental problem this system solves?

**Answer:**

I am an AI software developer. I develop AI programs, mostly web apps, enterprise-grade, end to end.

The problem I face is that in the development operations I generate massive amounts of information, and documents.

**First level, immediate pain:**
- I am not strictly orderly. I forget where I put some information, so I need to generate again from scratch. I forget how I named a document, so I have to write it all over again.
- **Specific current pain:** I completed an app. It's published, up and running. But its documentation is scattered all over my computer. I need to deliver an official hand-off document, but I don't know where to start looking for all those documents. Then, I'd have to read them all, many, many pages long, to extract the relevant information.
- **Urgent context document problem:** The AI assistants I use are all working with context I uploaded more than six months ago. Many things have changed! But the capsules of information about those changes and their updates are scattered all over my computer.

**Second level, strategic gain:**
- Many of the documents and codebases that I create have parts that can be reused. The way things are up to now, I have no practical way to do it. I wish to take modularity to the next level, and enable my future self to search my Single Source of Truth for all the parts that already exist, that can be efficiently, effectively, and successfully reused, and smoothly integrate them into my future projects. I don't want to have to invent sugary water every time I start a new project.

**Higher abstraction level (LOGOS):**
- The "LOGOS" of this project is to prevent unnecessary repetition of processes so that my time from idea to delivery is reduced to the absolute minimum.

---

### 2. What makes OCD different from existing solutions?

**Answer:**

GitHub, Notion, Obsidian, and file systems are passive tools. They are "dumb" storage. They are shelves (Library), lists (To Do), or folders (File System). They wait for you to use them.

**OCD is an active agent.**

You are building OCD because it is the only solution that integrates your Strategy, Tasks, and Code into a single, opinionated system that actively enforces your workflow.

The other tools fail because they are silos:
- Notion/Obsidian are great for your Library, but they cannot enforce a WIP=1 Kanban rule or auto-complete a task from a git merge.
- GitHub is great for your Express step, but it's a terrible Library and has no concept of your "Wife App" or your "Income vs. Authority" labels.
- A File System is just storage. It is not an application.

**The Unique Mechanism of OCD: AI-Gated Workflow**

OCD is not a tool; it's an operating system with agents and rules. It is designed to solve your specific, conflicting goals.

**Unique mechanisms OCD provides:**

1. **The "Stakeholder-to-Inbox" Pipeline:**
   - **The Problem:** Your wife needs to assign tasks ("interrupt"), but you need to Clean and Triage them to protect your focus.
   - **The "OCD" Mechanism:** OCD ingests interruptions without being interrupted. Her app writes to your Inbox, not your Kanban. The system architecture itself resolves your core "Wife App" conflict. No off-the-shelf tool does this.

2. **The "AI Filer" (Highest Autonomy Intake):**
   - **The Problem:** Filing a new idea is high-friction, administrative work.
   - **The "OCD" Mechanism:** You give the system a single, messy string: "urgent bug, Latina client texted." The AI Filer autonomously parses this, consults its rules, and correctly files the Item in the Expedite swimlane with High priority and the Job 1 (Income) label. This is not a "summarize" button; it is an autonomous filing agent.

3. **The "AI Librarian" (Corpus-Aware Analysis):**
   - **The Problem:** A new task might conflict with an existing task or one of your strategic goals (e.g., a "Red Light" item).
   - **The "OCD" Mechanism:** The AI Librarian autonomously runs in the background, comparing the new Item against your entire project corpus and strategy documents. It then attaches its findings (e.g., "Conflict: This duplicates LAT-10") as a passive note. It integrates your high-level strategy (the .md files) directly into your daily task management.

4. **The "AI Guardrail" (Enforced WIP=1):**
   - **The Problem:** You are, by your own admission, "addicted to coding on new projects," which "sabotages both jobs."
   - **The "OCD" Mechanism:** OCD enforces your focus. When you try to drag a second task into the Create column, the AI Guardrail stops you ("You can't do that. Your 'Create' (WIP) slot is full."). It is an external system designed to protect you from your own worst habits.

5. **The "PR-Merge-to-Done" (Enforced Best Practice):**
   - **The Problem:** Your "GitHub Green" goal requires best practices.
   - **The "OCD" Mechanism:** OCD automates and enforces a professional PR workflow. It moves tasks to In Review on a PR open and to Done on a PR merge. It is the only system that bakes your "GitHub Green" habit directly into the definition of "Done."

6. **The "Opus Corpus" System:**
   - **The Problem:** Context documents become stale. Information about changes and updates is scattered. You need documents that maintain the same name but have dynamic, always-updating content. Different situations require different versions (e.g., "Print my Resume for company A" vs "Print my Resume for company B").
   - **The "OCD" Mechanism:** One of the most important outputs of OCD will be the Opus Corpus. A set of opuses that by name are always the same ("Print my Resume" or "Print my Portfolio") but by content are always changing. They can require versioning per specific situations. The AI Storer and AI Retriever work together to maintain these opuses, automatically gathering scattered information and generating up-to-date versions on demand.

You are building OCD because it is the only tool that functions as an autonomous partner, built specifically to enforce your personal rules, protect your focus, and directly integrate your strategy with your code.

---

### 3. What are the essential components/agents that must exist for OCD to fulfill its purpose?

**Answer:**

**Must-haves (Non-negotiable):**

1. **Stakeholder-to-Inbox Pipeline** - Ingests interruptions without interrupting focus
2. **AI Filer** - Autonomous filing agent for high-friction intake
3. **AI Librarian** - Corpus-aware analysis for conflicts and strategic alignment
4. **AI Guardrail** - Enforced WIP=1 to protect focus
5. **AI Storer** - Keeps track of every addition, stores it INTELLIGENTLY in the Opus Corpus, and indexes it for fast and easy retrieval
   - **Concrete use case:** AI Storer can create an empty opus whenever a project starts and collect all related information there automatically. This solves the problem of documentation being scattered across the computer.
   - **Integration Role:** AI Storer handles the integration process when items reach Done, learning from user patterns to eventually automate integration.
   
6. **AI Retriever** - Retrieves INTELLIGENTLY documents, parts and modules relevant for consultation or reuse
   - **When:** Only on-demand (not automatic).
   - **Concrete use case:** Upon request, AI Retriever can read all information in an opus and create a proper, professional hand-off document, user manual, or any similar documentation. This eliminates the need to manually read through many pages to extract relevant information.
   - **Dynamic Documents:** For dynamic opuses (like Resume), AI Retriever gathers relevant information from the Opus Corpus and assembles a customized version based on request parameters.

**Nice-to-have:**

- **PR-Merge-to-Done** - Automated PR workflow enforcement

**Supporting Infrastructure:**

- **Opus Corpus** - The complete collection of opuses. Once an opus is created, it immediately becomes part of the Opus Corpus. It's nomenclature for "all my works" - requires UI to view all opuses on a single page, but no separate database structure. This is the Single Source of Truth that the AI Storer populates and the AI Retriever queries.

**Immediate Need:**

- A LIST of the opuses needed (this is itself one of the first opuses required).

---

### 4. How do these components work together? What is the workflow?

**Current State:**

Entry point: **CAPTURE** (defined and built)
End stage: **Opus Corpus** (the complete collection of opuses - final definition)

**Existing Workflow Draft:**
A rough draft exists at `opus system.txt` that outlines:
- STEP 1: CAPTURE → Inbox
- STEP 2: CLEAN (Clarify) → Create/On Hold/Compendium/Trash
- STEP 3: TRIAGE (Manual Prioritization)
- STEP 4: CREATE (Deep Work, WIP=1 enforced)
- STEP 5: PUBLISH (Done - mentions integration with Opus Corpus)
- STEP 6: RETROSPECTIVE (Meta-improvements)

**The REAL Question:**

The algorithms that happen **in between** - how things go from CAPTURE to the Opus Corpus. The current draft is high-level and not meticulously thought through.

**Strategic Questions:**

#### 4a. How does an Item transition from PUBLISH (Done) to becoming part of the Opus Corpus?

**Answer:**

**Opus Corpus is the end game.** All functions of the app serve the ultimate goal of nurturing Opus Corpus.

**The Filtering Process:**
- I capture anything and everything.
- Then, it gets filtered. All "actionable" items are labeled as "actionable" if I think or feel that they might in the end contribute to nurturing Opus Corpus.

**The Done Decision Point:**
When an Item reaches Done, it becomes a decision point with two possible outcomes:

1. **If an idea grows and ends up making sense:** Marking it "Done" means → **Insert into Opus Corpus.**
2. **If an idea ends up being not that meaningful:** Marking it "Done" means → **Send to Cold Storage.**

**Cold Storage Availability:**
- **"Send to Cold Storage" should be available both:**
  - **Before integration:** Send the item to Cold Storage (item-level decision)
  - **After integration:** Send the whole opus to Cold Storage (document-level decision)

**Progressive Autonomy Model:**
- **Phase 1 (Initial):** User decides every time. The system presents the decision: "Opus Corpus or Cold Storage?"
- **Phase 2 (With time and repetition):** AI can suggest based on learned patterns from previous decisions.
- **Phase 3 (With more time and more repetition):** AI will hopefully be able to decide autonomously, with user override capability.

*Note: This establishes a learning feedback loop where the AI Storer learns from user decisions to eventually automate the classification process.*

#### 4b. How are LIVE DOCUMENTS generated and maintained from the Opus Corpus?

**Answer:**

**Opus Corpus is the name of the set that contains all live documents.**

**What are Live Documents?**
Live Documents can be:
- Projects
- Books
- Workshops
- Apps
- Context documents
- Job applications
- Etc.

**Opus Properties (Live Documents):**
- **Name:** Editable name for the document (like a Google Doc title).
- **Content:** Editable content area (like a Google Doc body).
- **Strategic Document:** Checkbox (`isStrategic`) to mark documents that contain guiding principles (currently monetization and portfolio). Most opuses are NOT strategic.
- **Dynamic Document:** Checkbox (`isDynamic`) to mark documents that require on-demand customization (like Resume). Most opuses are NOT dynamic.
- **Creation:** System creates new opuses blank - just name and empty content, ready to be edited.
- **Opus Corpus:** Once an opus is created, it immediately becomes part of the Opus Corpus. Opus Corpus is nomenclature for "all my works" - it requires UI to view all opuses on a single page, but no separate database structure.

**Document Creation and Maintenance:**
- Each opus is created or updated by an idea being processed throughout all the workflow until marked as Done.
- The workflow itself is the primary mechanism for updating opuses.

**Two Types of Opuses:**

1. **Static Opuses:**
   - Most opuses will be "static" (`isDynamic = false`), in the sense that they are only updated by the workflow.
   - On request of print or download, the current content of the opus is printed or downloaded without any changes.
   - Example: Project documentation, hand-off documents, user manuals.

2. **Dynamic Opuses:**
   - Some opuses are "dynamic" (`isDynamic = true`), meaning that the current content will be modified at the moment of the print or download request, based on the information provided with the print or download request.
   - **Example: Resume** - The same person needs to be presented in a different way for job opportunity A than for job opportunity B. Whenever I request my Resume to be generated, I will provide information about the company and the position, so that the current content of the document be customized for that company and for that position.
   - The AI Retriever gathers relevant information from the Opus Corpus and assembles a customized version based on the request parameters.

**Update Triggers:**
- **Workflow-driven updates:** When Items reach Done and are inserted into Opus Corpus, they may update relevant opuses.
- **On-demand generation:** Dynamic opuses are generated/customized at the moment of request (print/download) based on provided context.

*Note: This establishes that opuses are living artifacts that evolve with the workflow, with some requiring real-time customization based on context.*

#### 4c. Where do AI Filer, AI Librarian, AI Storer, and AI Retriever fit into the workflow steps?

**Answer:**

**IMPORTANT NOTE:** Do not consider AI Filer, AI Librarian, AI Storer, and AI Retriever as final decisions. They are products of the first draft of the workflow, subject to all sorts of improvement.

---

**STEP 1: CAPTURE**
- **No AI needed.** Straightforward input - put ideas into the system.

---

**STEP 2: CLEAN**

**Job:** Process the Inbox to zero. This is a logistical gate.

**2.1 Clean (Clarify) - The Decision Tree:**

The question to answer is very simple and direct: **"Is this actionable?"**

- **Underlying thought:** "Can this item be transformed into a valuable addition to one of my opuses?"
- **If YES** → A harder question: **"Is it NOW?"**
  - The user has a natural sense of urgency but choices must be made.
  - **Two criteria govern choices:**
    1. **Is this opus immediately monetizable?** 
       - If YES → actionable + monetizable = **Kanban (Ready/To Do column)**
    2. **Is this opus a critical addition to my portfolio?**
       - If YES → actionable + portfolio = **Kanban (Ready/To Do column)**
  - **All other actionable items** → **ON HOLD** (permission to work on them when in a better financial position)
- **If NO** → See 2.4 below (Compendium/Trash)

**AI Fit:** These are simple binary logical gates. Perfectly suitable for the progressive autonomy model (manual → AI suggests → AI decides).

**2.2 IF ACTIONABLE: Assign Item to Opus**

**The Question:** "Where does this item belong?"

- **Requires THINKING** - Sorting items into opuses feels like sorting students into Hogwarts houses. It takes wisdom.
- **Possible answers:**
  - **One existing opus:** Tag it (set `opusId`). The item is immediately moved from inbox to the kanban board (typically to the "Ready / To Do" column). The kanban can be filtered to show only items for that opus.
  - **Multiple opuses:** The item must be **cloned/copied** into all opuses where it belongs. Each clone evolves differently to maximize value for each different opus.
    - **Example:** Job at Prestigious Company → clones for LinkedIn About, Resume, Context text, etc.
    - **Important:** Each clone or copy is a new item. Even when the content is the same, it has its own id and follows its own independent path. No relation between clones needed. They are completely independent.
  - **None of the existing opuses:** Create a new opus, then tag it.
    - **Opus Creation:** The system creates the new opus blank.
    - **Think of a new Google Documents document:** Has a name (that can be edited). Has some content (that is to be edited). And that's it.
    - **No complex structure needed initially** - just a blank document ready for content.
    - **Opus Corpus:** Once created, the opus immediately becomes part of the Opus Corpus (nomenclature for "all my works").

**AI Fit:** A little far-fetched because it requires THINKING, but suitable for progressive autonomy model (manual → AI suggests → AI decides).

**2.3 Comment (Optional)**

- **No AI here.** This field exists because many times ideas are captured minimally due to hurry, but more information exists that is useful. User provides additional information and explanations of thought process.

**2.4 Send to Next Step**

**Outcome:** Items go to Kanban (Ready/To Do column)/On Hold/Compendium/Trash

**AI Librarian Activation:**
- **When:** AI Librarian runs when an item **exits CLEAN** (after CLEAN step is complete).
- **Why:** An item in CAPTURE has insufficient information to be assessed. By the time it exits CLEAN, it has been clarified and assigned to an opus.
- **What it does:** 
  - Compares the new Item against the entire project corpus and **Strategic Documents** (opuses with `isStrategic = true`).
  - Assesses the probability of an idea to **contribute to** the guiding principles (monetization and portfolio).
  - Assesses the probability of an idea to **undermine** the guiding principles.
  - Attaches findings as passive notes (e.g., "Conflict: This duplicates LAT-10" or "High alignment with portfolio goals").

**What happens when an item is NOT actionable?**

- **Trash:** Soft delete. At any point during the whole workflow, user can change mind and completely delete an item.
- **Compendium:** Reference information (static, searchable). Won't be built around, won't be incorporated into opuses, won't make money, won't make wiser. But might be needed randomly.
  - **Examples:** Birthday dates, bank account numbers, exact dog food brand name, coffee producer/store info, breakfast place opening hours.
  - **Search features:** Google-like search suggestions under the search bar can be helpful.
  - **AI Fit:** AI can probably guess what user is looking for and help find it faster.

**Additional Requirement:**
- User needs to freely move items between **Kanban (Ready/To Do) ↔ On Hold** based on changed circumstances, new relevant information, or just a hunch.

---

**STEP 3: TRIAGE (Manual Prioritization)**

- **No AI needed.** This is an "Expertise Decision" and it can stay like that.
- **In real life:** Some days the user just wakes up inspired to tackle ONE specific item, and that's that (intuitive/emotional decision).
- **Other days:** The user thinks about it and takes a rational decision.
- **Job:** Strategically select the one task for the next Deep Work session.
- **Method:** Expertise Decision. The Creator reviews the Kanban board (all swimlanes and priorities).
- **System Action:** User pulls one Item from the "Ready / To Do" column into the CREATING column. This is the explicit start signal.

**STEP 4: CREATE (Deep Work) - The Kanban Phase**

**Naming Clarification:**
- **High Level:** "CREATE" refers to the entire kanban phase (this workflow step)
- **Mid Level:** "CREATING" is the name of one kanban column (In Progress/Doing)
- **Low Level:** Kanban columns are the visual representation of the workflow

**Standard Kanban Columns:**
1. **Blocked** (Column 0, extreme left) - Waiting on someone/something. Prevents hidden delays.
2. **Backlog** - Ideas, requests, tasks not yet approved.
3. **Ready / To Do** - Approved and ready to start. Acceptance criteria clear.
4. **CREATING** (In Progress / Doing) - Actively being worked on right now. This is the "CREATING" column.
5. **Review / QA** - Work finished but needs checking, testing, or approval.
6. **Done** - Meets definition of done and requires no further action.

**Note:** CREATE is correct for everything that happens during the kanban phase. The column named CREATING represents "In Progress/Doing" work.

- **AI Usage:** The user does use AI to CREATE, but uses it outside of the OCD system.
  - User will have multiple tabs open and have conversations with multiple AI models, but independently.
  - The OCD system interacts with the user only, not with external AI tools.
- **Job:** The Creator executes the chosen task with zero distraction.
- **Method:** The user works on the one task. The system enforces the WIP=1 rule on the CREATING column.
- **System Action:** The system guardrail prevents any other Item from being moved to the CREATING column. The system knows the Kanban method rules and educates the user when they try to break any of the rules. These are educational messages only; user may dismiss them and continue breaking the rules.

**STEP 5: PUBLISH**

**Job:** The task is complete and VERIFIED BY AI in the background.

- **During work:** As the user works on the item, AI could routinely check if what they're building is congruent or contradicts what already exists in the opus.

**Method:** Manual drag from CREATING column to Done (or automated via GitHub webhooks)

- **User action:** Drag and drop, or click on the "Done" button, can be done by the user only.
- **Webhooks:** The webhooks idea is efficient, but unnecessary. Kind of adds drag to the flow.
- **On click (moving to Done):** AI must check if what the user is building is congruent or contradicts what already exists in the opus.

**System Action:** When status is set to Done, this update is integrated with the Opus (via AI Storer).

**Important:** Only items that go to **Opus Corpus** get integrated. **Cold Storage items do NOT get integrated.** Integration only happens for items that the user decides should become part of the Opus Corpus.

**AI Storer Role:**
- **AI Storer** handles the integration process.
- It learns from user integration patterns to eventually automate the process.

**Initial Implementation (Manual):**
- User will do it manually.
- **UI Requirements:** Need a UI page with two areas:
  - One area with the done item.
  - Other area with the opus.
  - Time and patience to find the right place.
  - The option to edit item or edit opus one click away.

**Integration Process:**
1. User clicks to edit the opus.
2. User copy-pastes the item content into the opus at the desired location.
3. User closes edit view.
4. User clicks save.
5. If user is satisfied, user clicks "Item has been integrated" (or similar).
6. Confirmation modal appears for safety.
7. If user confirms, integration is marked as done.

**After Integration:**
- After integration is confirmed, the item is no longer necessary. It will never again be necessary on its own.
- **Process:** Confirm integration is satisfactory, then **hard delete** the item.

**AI Fit - The Magic:**
- This is where really powerful magic can be done! If AI learns to integrate like the user integrates, then the production workflow can really accelerate!
- **The progressive autonomy model (manual → AI suggests → AI decides) should start learning ASAP.**
- This is where **AI Storer** fits in - learning how to intelligently integrate completed items into their corresponding opuses.

**STEP 6: RETROSPECTIVE**

**AI-Driven Process:**
- AI should be able to do the retrospective independently.
- AI asks clarifying questions via new captured items to the user's inbox.
- AI asks for any additional help it needs via new captured items to the user's inbox.

**Job (The "Why"):** To analyze the system's performance and identify actionable improvements to the workflow, rules, or AI implementations.

**Method (The "How"):** A periodic (e.g., weekly) review of the system's throughput and friction points. The user is not doing tasks; the system is asking:
- **Kanban Review:** Look at the Done column. What was the throughput?
- **Friction Review:** Look at the Blocked items. What was the real reason they were blocked?
- **Interruption Review:** Look at the Expedite swimlane. How many interruptions sidetracked the user? Can this be reduced?
- **Triage Review:** Look at the On Hold list. Should any of these be promoted to the Workflow or moved to Cold Storage?

**System Action (The "What"):** The output of this step is a set of new Items for improving the system itself. The AI captures these new "meta-tasks" (e.g., "Tune AI Filer prompt to better handle 'Habit' tasks" or "Add a new Rule to the AI Guardrail") which then enter the user's Inbox to be processed in the next Clean cycle, just like any other task.

**AI Fit:** This is where **AI Librarian** (or a similar agent) fits in - autonomously analyzing the system's performance and generating improvement suggestions that feed back into the workflow.

**Note:** AI Librarian has two distinct roles:
1. **During CLEAN exit:** Assesses new items against Strategic Documents (opuses with `isStrategic = true`) for alignment with guiding principles (monetization and portfolio).
2. **During RETROSPECTIVE:** Analyzes system performance and generates improvement suggestions.

**Kanban Board Structure:**
- **Single unified kanban board** showing all items.
- **Filtering:** User can filter the kanban to show only items tagged to a specific opus (`opusId`).
- **Why filtering:** All items don't fit on the screen at once, so filtering by opus helps focus.
- **Structure is fine** - it's just a view/filtering mechanism, not separate boards.

---

