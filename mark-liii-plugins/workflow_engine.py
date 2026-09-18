"""
Workflow Engine — Multi-Step Workflows for JARVIS (Mark LIII)
Makes JARVIS execute complex multi-step tasks — morning routine, project setup, etc.

Inspired by ONEPUNCHMAN411 macro_executor.py + automation_master.py workflow JSON
+ Mark LIII dev_agent complex 3+ steps + magi_system max mode.

Free & open source, zero tokens.
"""

import json
import time
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "workflow_engine",
    "description": (
        "Multi-step workflow engine master — makes JARVIS execute complex tasks (zero tokens). "
        "Actions: create name=... steps=... [trigger=manual/schedule/event] [description=...] — create workflow steps JSON array [{action: app_launcher_pro params: {action: launch name: chrome}} {action: browser_master params: {action: navigate url: https://gmail.com}} {action: pc_master params: {action: volume value: 50}}] trigger manual/schedule cron 0 9 * * * / event file_created path ~/Downloads stored ~/.jarvis_workflows/{name}.json, run name=... [vars=...] — run workflow with optional vars JSON {\"project\": \"MyApp\"} returns step-by-step results stops on failure unless continue_on_error true, list — list workflows name steps count trigger last run success rate, show name=... — show workflow steps detailed, delete name=... — delete workflow, edit name=... steps=... — edit steps, add_step name=... step=... [position=...] — add step at position append if none, remove_step name=... index=... — remove step by index, export name=... path=... / import path=... — export/import JSON, triggers — list triggers and workflows, help. "
        "Workflow JSON: name, description, trigger type manual/schedule cron/event, vars, steps array each {action, params, continue_on_error false, condition null, delay 0, loop null}, created, last_run, runs, success_rate. Conditionals simple if file_exists path then continue else skip. Loops for_each file in ~/Downloads/*.pdf steps [...]. "
        "Use when user wants workflow, multi-step task, morning routine, project setup, automate sequence, workflow engine. "
        "Trigger phrases: workflow engine, create workflow, run workflow, list workflows, morning routine, project setup, automate sequence, multi-step task."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: create, run, list, show, delete, edit, add_step, remove_step, export, import, triggers, help. Default list.",
            },
            "name": {"type": "STRING", "description": "Workflow name, e.g. morning_routine, project_setup, my_workflow"},
            "steps": {"type": "STRING", "description": "Steps JSON array string for create/edit, e.g. [{\"action\": \"pc_master\", \"params\": {\"action\": \"volume\", \"value\": 50}}]"},
            "step": {"type": "STRING", "description": "Single step JSON for add_step, e.g. {\"action\": \"pc_master\", \"params\": {\"action\": \"volume\", \"value\": 50}}"},
            "trigger": {"type": "STRING", "description": "Trigger JSON or string manual/schedule/event, e.g. manual or {\"type\": \"schedule\", \"cron\": \"0 9 * * *\"}"},
            "description": {"type": "STRING", "description": "Workflow description"},
            "vars": {"type": "STRING", "description": "Vars JSON for run, e.g. {\"project\": \"MyApp\"}"},
            "position": {"type": "NUMBER", "description": "Position for add_step, 0-indexed, default append"},
            "index": {"type": "NUMBER", "description": "Index for remove_step, 0-indexed"},
            "path": {"type": "STRING", "description": "Path for export/import, e.g. ~/workflow.json"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "workflow_engine",
    "title": "Workflow Engine — Multi-Step Workflows",
    "description": "Execute multi-step workflows with conditionals, loops, triggers — zero tokens",
    "icon": "⚙️",
    "color": "#8B5CF6",
    "order": 42,
    "default_enabled": True,
    "fields": [
        {"key": "workflows_dir", "label": "Workflows directory", "type": "text", "default": "~/.jarvis_workflows"},
        {"key": "enable_scheduler", "label": "Enable scheduler thread", "type": "checkbox", "default": False},
    ],
}

_workflows_dir = Path.home() / ".jarvis_workflows"
_runs_file = Path.home() / ".jarvis_workflow_runs.jsonl"

def _ensure_dirs():
    try:
        _workflows_dir.mkdir(parents=True, exist_ok=True)
        _runs_file.parent.mkdir(parents=True, exist_ok=True)
        if not _runs_file.exists():
            _runs_file.touch()
    except Exception:
        pass

def _load_workflow(name):
    _ensure_dirs()
    file_path = _workflows_dir / f"{name}.json"
    if not file_path.exists():
        return None, f"Workflow '{name}' not found — list to see available"
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        return data, None
    except Exception as e:
        return None, str(e)

def _save_workflow(name, data):
    _ensure_dirs()
    file_path = _workflows_dir / f"{name}.json"
    try:
        file_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return file_path, None
    except Exception as e:
        return None, str(e)

def _run_plugin_action(action_name, params):
    """Run plugin action via importlib."""
    try:
        import importlib.util
        possible_paths = [
            Path(__file__).parent / f"{action_name}.py",
            Path.home() / "Mark-LIII" / "plugins" / f"{action_name}.py",
        ]
        plugin_path = None
        for p in possible_paths:
            if p.exists():
                plugin_path = p
                break
        if not plugin_path:
            return None, f"Plugin file {action_name}.py not found"

        spec = importlib.util.spec_from_file_location(action_name, plugin_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if not hasattr(mod, 'run'):
            return None, f"Plugin {action_name} has no run()"

        result = mod.run(params)
        # Detect failure by keywords
        result_lower = str(result).lower()
        if any(k in result_lower for k in ["failed", "not found", "no element", "no window", "error", "not installed"]) and "success" not in result_lower:
            # Heuristic: if result contains failure keywords, treat as failure unless it's success message
            # But allow "not found" to be considered failure for workflow purposes
            return result, f"Action returned failure: {result[:200]}"
        return result, None
    except Exception as e:
        return None, f"Run plugin {action_name} failed: {e}"

def _evaluate_condition(condition, vars_dict):
    """Evaluate simple condition."""
    if not condition:
        return True
    try:
        cond_type = condition.get("if", "")
        if cond_type == "file_exists":
            path = condition.get("path", "")
            # Replace vars
            for k, v in vars_dict.items():
                path = path.replace(f"{{{k}}}", str(v)).replace(f"{{{{{k}}}}}", str(v))
            p = Path(path).expanduser()
            exists = p.exists()
            then = condition.get("then", "continue")
            else_action = condition.get("else", "skip")
            if exists:
                return then != "skip"
            else:
                return else_action != "skip"
        # Add more condition types as needed
        return True
    except Exception:
        return True

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "list") or "list").lower().strip()
    name = parameters.get("name", "") or ""
    steps_str = parameters.get("steps", "") or ""
    step_str = parameters.get("step", "") or ""
    trigger_str = parameters.get("trigger", "manual") or "manual"
    description = parameters.get("description", "") or ""
    vars_str = parameters.get("vars", "") or ""
    position = parameters.get("position", None)
    try:
        position = int(position) if position is not None else None
    except Exception:
        position = None
    index = parameters.get("index", None)
    try:
        index = int(index) if index is not None else None
    except Exception:
        index = None
    path_str = parameters.get("path", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Workflow Engine: {action} name={name}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Workflow Engine — Multi-Step Workflows (Zero Tokens, from ONEPUNCHMAN411 macro_executor + automation_master workflow JSON + Mark LIII dev_agent):\n"
                "\n"
                "Execute complex multi-step tasks: morning routine, project setup, automate sequence.\n"
                "\n"
                "• create name=... steps=... [trigger=...] [description=...] — create workflow, steps JSON array e.g., [{\"action\":\"app_launcher_pro\",\"params\":{\"action\":\"launch\",\"name\":\"chrome\"}}, {\"action\":\"browser_master\",\"params\":{\"action\":\"navigate\",\"url\":\"https://gmail.com\"}}, {\"action\":\"pc_master\",\"params\":{\"action\":\"volume\",\"value\":50}}], trigger manual or {\"type\":\"schedule\",\"cron\":\"0 9 * * *\"} or {\"type\":\"event\",\"event\":\"file_created\",\"path\":\"~/Downloads\"}, stored ~/.jarvis_workflows/{name}.json, fields name description trigger vars steps created last_run runs success_rate\n"
                "• run name=... [vars=...] — run workflow with optional vars JSON {\"project\":\"MyApp\"}, returns step-by-step results, stops on failure unless continue_on_error true, logs to ~/.jarvis_workflow_runs.jsonl\n"
                "• list — list workflows name steps count trigger last run success rate\n"
                "• show name=... — show workflow steps detailed with condition delay loop\n"
                "• delete name=... — delete workflow JSON\n"
                "• edit name=... steps=... — edit workflow steps (replace)\n"
                "• add_step name=... step=... [position=...] — add step JSON at position (0-indexed) append if none, step e.g., {\"action\":\"pc_master\",\"params\":{\"action\":\"volume\",\"value\":50}}\n"
                "• remove_step name=... index=... — remove step by index 0-indexed\n"
                "• export name=... path=... — export workflow JSON to custom path, import path=... — import JSON as workflow (filename becomes name)\n"
                "• triggers — list triggers and workflows (manual, schedule cron, event file_created)\n"
                "\n"
                "Workflow JSON format:\n"
                "{\n"
                "  \"name\": \"morning_routine\",\n"
                "  \"description\": \"Open Chrome Gmail + VS Code MyProject + volume 50 + organize Downloads\",\n"
                "  \"trigger\": {\"type\": \"manual\"} or {\"type\": \"schedule\", \"cron\": \"0 9 * * *\"} or {\"type\": \"event\", \"event\": \"file_created\", \"path\": \"~/Downloads\"},\n"
                "  \"vars\": {\"project\": \"MyApp\"},\n"
                "  \"steps\": [\n"
                "    {\"action\": \"app_launcher_pro\", \"params\": {\"action\": \"launch\", \"name\": \"chrome\"}, \"continue_on_error\": false, \"condition\": null, \"delay\": 0},\n"
                "    {\"action\": \"browser_master\", \"params\": {\"action\": \"navigate\", \"url\": \"https://gmail.com\"}, \"delay\": 2}\n"
                "  ],\n"
                "  \"created\": \"2026-09-16T10:00:00\",\n"
                "  \"last_run\": null,\n"
                "  \"runs\": 0,\n"
                "  \"success_rate\": 0\n"
                "}\n"
                "Conditionals: {\"if\": \"file_exists\", \"path\": \"~/Downloads/report.pdf\", \"then\": \"continue\", \"else\": \"skip\"}\n"
                "Loops: {\"for_each\": \"file in ~/Downloads/*.pdf\", \"steps\": [...] } (Phase 3 simple, future)\n"
                "\n"
                "Examples:\n"
                "• workflow_engine action=create name=morning_routine steps=[{\"action\":\"app_launcher_pro\",\"params\":{\"action\":\"launch\",\"name\":\"chrome\"}}, {\"action\":\"browser_master\",\"params\":{\"action\":\"navigate\",\"url\":\"https://gmail.com\"}}] description=Morning routine\n"
                "• workflow_engine action=run name=morning_routine vars={\"project\":\"MyApp\"}\n"
                "• workflow_engine action=list\n"
                "• workflow_engine action=show name=morning_routine\n"
                "\n"
                "Zero tokens, pure local via json, pathlib, importlib.\n"
                "Workflows: ~/.jarvis_workflows/*.json, runs: ~/.jarvis_workflow_runs.jsonl\n"
            )

        if action == "create":
            if not name or not steps_str:
                return "Need name and steps: create name=morning_routine steps=[{\"action\":\"pc_master\",\"params\":{\"action\":\"volume\",\"value\":50}}] — steps JSON array"
            try:
                steps = json.loads(steps_str) if isinstance(steps_str, str) else steps_str
                if not isinstance(steps, list):
                    return "Steps must be JSON array, e.g., [{\"action\":\"pc_master\",\"params\":{...}}]"
            except Exception as e:
                return f"Invalid steps JSON: {e} — must be valid JSON array"

            # Parse trigger
            try:
                if isinstance(trigger_str, str) and trigger_str.startswith("{"):
                    trigger = json.loads(trigger_str)
                else:
                    # Simple string like manual, schedule, event
                    if trigger_str == "manual":
                        trigger = {"type": "manual"}
                    elif trigger_str.startswith("schedule"):
                        # Try parse cron from string
                        trigger = {"type": "schedule", "cron": "0 9 * * *"}
                    else:
                        trigger = {"type": trigger_str}
            except Exception:
                trigger = {"type": "manual"}

            workflow = {
                "name": name,
                "description": description or f"Workflow {name}",
                "trigger": trigger,
                "vars": {},
                "steps": steps,
                "created": datetime.now().isoformat(),
                "last_run": None,
                "runs": 0,
                "success_rate": 0,
                "success_count": 0,
            }

            file_path, err = _save_workflow(name, workflow)
            if err:
                return f"Create workflow failed: {err}"
            return f"Created workflow '{name}' with {len(steps)} steps trigger {trigger} to {file_path} — zero tokens, local JSON\nSteps: {', '.join([s.get('action','unknown') for s in steps[:5]])}{' ...' if len(steps)>5 else ''}"

        if action == "run":
            if not name:
                return "Need name: run name=morning_routine [vars={\"project\":\"MyApp\"}]"
            workflow, err = _load_workflow(name)
            if err:
                return err

            # Parse vars
            vars_dict = {}
            if vars_str:
                try:
                    vars_dict = json.loads(vars_str) if isinstance(vars_str, str) else vars_str
                except Exception:
                    return f"Invalid vars JSON: {vars_str}"

            # Merge with workflow vars
            merged_vars = {**workflow.get("vars", {}), **vars_dict}

            steps = workflow.get("steps", [])
            if not steps:
                return f"Workflow '{name}' has no steps"

            results = []
            success_count = 0
            for i, step in enumerate(steps):
                try:
                    # Check condition
                    condition = step.get("condition")
                    if condition and not _evaluate_condition(condition, merged_vars):
                        results.append(f"Step {i+1}/{len(steps)} {step.get('action')} — skipped due to condition {condition}")
                        continue

                    # Delay
                    delay = step.get("delay", 0)
                    if delay > 0:
                        time.sleep(delay)

                    action_name = step.get("action", "")
                    params = step.get("params", {})

                    # Replace vars in params
                    params_str_json = json.dumps(params)
                    for k, v in merged_vars.items():
                        params_str_json = params_str_json.replace(f"{{{k}}}", str(v)).replace(f"{{{{{k}}}}}", str(v)).replace(f"${k}", str(v))
                    try:
                        params = json.loads(params_str_json)
                    except Exception:
                        pass

                    if not action_name:
                        results.append(f"Step {i+1}/{len(steps)} — no action name, skipped")
                        continue

                    result, error = _run_plugin_action(action_name, params)
                    if error:
                        results.append(f"Step {i+1}/{len(steps)} {action_name} — FAILED: {error} — result: {result}")
                        if not step.get("continue_on_error", False):
                            results.append(f"Stopping workflow due to failure at step {i+1} (continue_on_error false)")
                            break
                    else:
                        results.append(f"Step {i+1}/{len(steps)} {action_name} — SUCCESS: {str(result)[:200]}")
                        success_count += 1

                except Exception as e:
                    results.append(f"Step {i+1}/{len(steps)} {step.get('action','unknown')} — EXCEPTION: {e}")
                    if not step.get("continue_on_error", False):
                        break

            # Update workflow stats
            try:
                workflow["last_run"] = datetime.now().isoformat()
                workflow["runs"] = workflow.get("runs", 0) + 1
                workflow["success_count"] = workflow.get("success_count", 0) + (1 if success_count == len(steps) else 0)
                workflow["success_rate"] = (workflow["success_count"] / workflow["runs"] * 100) if workflow["runs"] > 0 else 0
                _save_workflow(name, workflow)
            except Exception:
                pass

            # Log run
            try:
                _ensure_dirs()
                run_log = {
                    "timestamp": datetime.now().isoformat(),
                    "workflow": name,
                    "vars": merged_vars,
                    "steps_total": len(steps),
                    "steps_success": success_count,
                    "success": success_count == len(steps),
                    "results": results,
                }
                with _runs_file.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(run_log, ensure_ascii=False) + "\n")
            except Exception:
                pass

            return f"Ran workflow '{name}' — {success_count}/{len(steps)} steps succeeded, success rate {workflow.get('success_rate',0):.1f}% — zero tokens\n\n" + "\n".join(results)

        if action == "list":
            _ensure_dirs()
            try:
                files = list(_workflows_dir.glob("*.json"))
                if not files:
                    return "No workflows — create via create name=... steps=..."
                lines = []
                for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True):
                    try:
                        data = json.loads(f.read_text(encoding="utf-8"))
                        steps_count = len(data.get("steps", []))
                        trigger = data.get("trigger", {}).get("type", "manual")
                        last_run = data.get("last_run", "")[:19] if data.get("last_run") else "never"
                        success_rate = data.get("success_rate", 0)
                        lines.append(f"• {f.stem} — {steps_count} steps, trigger {trigger}, last run {last_run}, success rate {success_rate:.1f}%, {f.stat().st_size} bytes")
                    except Exception:
                        lines.append(f"• {f.stem} — (corrupt)")
                return f"Workflows ({len(files)}) in {_workflows_dir}:\n" + "\n".join(lines)
            except Exception as e:
                return f"List workflows failed: {e}"

        if action == "show":
            if not name:
                return "Need name: show name=morning_routine"
            workflow, err = _load_workflow(name)
            if err:
                return err
            lines = [
                f"Workflow '{name}':",
                f"• Description: {workflow.get('description','')}",
                f"• Trigger: {workflow.get('trigger')}",
                f"• Vars: {workflow.get('vars')}",
                f"• Created: {workflow.get('created','')[:19]}",
                f"• Last run: {workflow.get('last_run','never')}",
                f"• Runs: {workflow.get('runs',0)}, Success rate: {workflow.get('success_rate',0):.1f}%",
                f"• Steps ({len(workflow.get('steps',[]))}):",
            ]
            for i, step in enumerate(workflow.get("steps", []), 1):
                lines.append(f"  {i}. {step.get('action')} params {json.dumps(step.get('params',{}))[:100]} continue_on_error={step.get('continue_on_error',False)} delay={step.get('delay',0)} condition={step.get('condition')}")
            return "\n".join(lines)

        if action == "delete":
            if not name:
                return "Need name: delete name=morning_routine"
            _ensure_dirs()
            file_path = _workflows_dir / f"{name}.json"
            if not file_path.exists():
                return f"Workflow '{name}' not found"
            try:
                file_path.unlink()
                return f"Deleted workflow '{name}'"
            except Exception as e:
                return f"Delete failed: {e}"

        if action == "edit":
            if not name or not steps_str:
                return "Need name and steps: edit name=morning_routine steps=[...]"
            workflow, err = _load_workflow(name)
            if err:
                return err
            try:
                steps = json.loads(steps_str) if isinstance(steps_str, str) else steps_str
                if not isinstance(steps, list):
                    return "Steps must be JSON array"
            except Exception as e:
                return f"Invalid steps JSON: {e}"
            workflow["steps"] = steps
            file_path, err = _save_workflow(name, workflow)
            if err:
                return f"Edit failed: {err}"
            return f"Edited workflow '{name}' — now {len(steps)} steps"

        if action == "add_step":
            if not name or not step_str:
                return "Need name and step: add_step name=morning_routine step={\"action\":\"pc_master\",\"params\":{...}} position=0"
            workflow, err = _load_workflow(name)
            if err:
                return err
            try:
                step = json.loads(step_str) if isinstance(step_str, str) else step_str
                if not isinstance(step, dict):
                    return "Step must be JSON object"
            except Exception as e:
                return f"Invalid step JSON: {e}"
            steps = workflow.get("steps", [])
            if position is not None and 0 <= position <= len(steps):
                steps.insert(position, step)
            else:
                steps.append(step)
            workflow["steps"] = steps
            file_path, err = _save_workflow(name, workflow)
            if err:
                return f"Add step failed: {err}"
            return f"Added step to workflow '{name}' at position {position if position is not None else 'end'} — now {len(steps)} steps"

        if action == "remove_step":
            if not name or index is None:
                return "Need name and index: remove_step name=morning_routine index=0"
            workflow, err = _load_workflow(name)
            if err:
                return err
            steps = workflow.get("steps", [])
            if not (0 <= index < len(steps)):
                return f"Index {index} out of range 0-{len(steps)-1}"
            removed = steps.pop(index)
            workflow["steps"] = steps
            file_path, err = _save_workflow(name, workflow)
            if err:
                return f"Remove step failed: {err}"
            return f"Removed step {index} ({removed.get('action')}) from workflow '{name}' — now {len(steps)} steps"

        if action == "export":
            if not name or not path_str:
                return "Need name and path: export name=morning_routine path=~/workflow.json"
            workflow, err = _load_workflow(name)
            if err:
                return err
            try:
                export_path = Path(path_str).expanduser()
                export_path.parent.mkdir(parents=True, exist_ok=True)
                export_path.write_text(json.dumps(workflow, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Exported workflow '{name}' to {export_path} — {export_path.stat().st_size} bytes"
            except Exception as e:
                return f"Export failed: {e}"

        if action == "import":
            if not path_str:
                return "Need path: import path=~/workflow.json"
            try:
                import_path = Path(path_str).expanduser()
                if not import_path.exists():
                    return f"File not found: {import_path}"
                data = json.loads(import_path.read_text(encoding="utf-8"))
                name_from_file = data.get("name") or import_path.stem
                _ensure_dirs()
                dest = _workflows_dir / f"{name_from_file}.json"
                dest.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Imported workflow '{name_from_file}' from {import_path} to {dest} — {len(data.get('steps',[]))} steps"
            except Exception as e:
                return f"Import failed: {e}"

        if action == "triggers":
            _ensure_dirs()
            try:
                files = list(_workflows_dir.glob("*.json"))
                if not files:
                    return "No workflows — no triggers"
                triggers = {}
                for f in files:
                    try:
                        data = json.loads(f.read_text(encoding="utf-8"))
                        trig_type = data.get("trigger", {}).get("type", "manual")
                        if trig_type not in triggers:
                            triggers[trig_type] = []
                        triggers[trig_type].append(f.stem)
                    except Exception:
                        continue
                lines = [f"Triggers ({len(files)} workflows):"]
                for trig_type, names in triggers.items():
                    lines.append(f"• {trig_type}: {', '.join(names)}")
                return "\n".join(lines)
            except Exception as e:
                return f"Triggers failed: {e}"

        return f"Unknown action {action}. Say 'workflow_engine action=help'"

    except Exception as e:
        return f"Workflow Engine failed: {e}"
