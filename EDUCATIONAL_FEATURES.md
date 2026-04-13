# CFG Simplifier

CFG Simplifier is an interactive platform designed to teach and visualize the formal process of simplifying Context-Free Grammars. The site provides a hands-on environment where abstract mathematical concepts are converted into a clear, visual narrative.

## Educational Features

### Dynamic Rule Builder
The platform includes an intelligent construction tool that allows users to quickly define complex grammars. It handles multiple notations and automatically organizes productions, helping learners focus on the structure of their language rather than syntax formatting.

### Interactive Transformation Pipeline
The core of the site is a multi-stage pipeline that executes formal simplification algorithms in the correct mathematical sequence. By separating the process into distinct stages, it teaches the importance of order in rule elimination. Each stage provides a side-by-side comparison of the grammar state, highlighting exactly what was added or removed.

### Curated Educational Examples
A built-in library of examples is provided to demonstrate specific theoretical "edge cases." These include scenarios with cascading null productions, deep unit chain dependencies, and highly interconnected grammars. These pre-loaded cases allow students to immediately see the impact of algorithms on complex structures without manual entry errors.

### Convergence and Stability Validation
The tool includes a final validation pass that re-executes the entire pipeline on the final result. This teaches the concept of mathematical convergence, proving to the student that the grammar has reached its most minimal, stable form and that no further reductions are possible.

### Dependency Graph Analysis
For every stage of the simplification, the tool generates a force-directed network graph. This converts abstract symbol relationships into a spatial layout. Students can visually identify unreachable variables (nodes with no path from the start symbol) and unit production chains, making complex connectivity properties instantly recognizable.

### Step-by-Step Walkthrough
The cinematic walkthrough mode breaks down the entire simplification process into individual, granular changes. It serves as a digital tutor, walking the user through every single rule modification with dedicated reasoning logs. The "Auto-Play" feature allows the entire process to be viewed as a continuous demonstration, making it ideal for classroom presentations.

### Real-time Grammar Membership Checker
Once a grammar has been minimized, users can test specific strings against it. The membership checker provides a leftmost derivation trace, showing the sequence of substitutions that lead to the final string. This validates that the simplified grammar still produces the desired language and demonstrates the derivation process in action.

### Flexible Notation Support
The tool is designed to be textbook-agnostic, supporting a wide variety of formal notations including multiple arrow types and branch separators. This reduces the barrier to entry for students coming from different academic backgrounds, allowing them to use the notation they are most familiar with.

### Algorithmic Reasoning Logs
Every operation performed by the tool is accompanied by a detailed logical explanation. Instead of just seeing a result, users get a description of why a specific rule was flagged and how the transformation preserves the language's integrity.

### Professional PDF Export
The ability to download a comprehensive report allows students and teachers to document the entire transformation process. These reports include high-resolution graph captures and full derivation logs, providing a perfect resource for study and grading.

---
