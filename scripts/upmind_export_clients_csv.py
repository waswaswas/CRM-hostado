import csv
import os
from typing import Any, Dict, Iterable, List, Optional

import requests


def first_non_empty(*values: Optional[str]) -> str:
    for value in values:
        if value:
            value = str(value).strip()
            if value:
                return value
    return ""


def get_nested(source: Dict[str, Any], *keys: str) -> str:
    current: Any = source
    for key in keys:
        if not isinstance(current, dict):
            return ""
        current = current.get(key)
    return first_non_empty(current if isinstance(current, str) else "")


def extract_client_fields(client: Dict[str, Any]) -> Dict[str, str]:
    name = first_non_empty(
        client.get("name"),
        client.get("full_name"),
        client.get("company_name"),
        client.get("company"),
    )
    company = first_non_empty(client.get("company"), client.get("company_name"))
    email = first_non_empty(
        client.get("email"),
        get_nested(client, "primary_contact", "email"),
        get_nested(client, "contact", "email"),
    )
    phone = first_non_empty(
        client.get("phone"),
        get_nested(client, "primary_contact", "phone"),
        get_nested(client, "contact", "phone"),
    )
    source = first_non_empty(client.get("source"), client.get("lead_source"))
    notes_summary = first_non_empty(client.get("notes"), client.get("note"))
    return {
        "name": name,
        "company": company,
        "email": email,
        "phone": phone,
        "source": source,
        "notes_summary": notes_summary,
    }


def fetch_all_clients(api_url: str, headers: Dict[str, str]) -> List[Dict[str, Any]]:
    clients: List[Dict[str, Any]] = []
    url: Optional[str] = api_url

    while url:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            clients.extend(data)
            url = None
            continue

        page_clients = (
            data.get("results")
            or data.get("clients")
            or data.get("data")
            or []
        )
        if isinstance(page_clients, list):
            clients.extend(page_clients)
        else:
            raise ValueError("Unexpected clients payload shape from Upmind API.")

        url = data.get("next") or data.get("links", {}).get("next")

    return clients


def main() -> None:
    token = os.getenv("UPMIND_API_TOKEN")
    if not token:
        raise SystemExit("Missing UPMIND_API_TOKEN env var.")

    api_url = os.getenv("UPMIND_API_URL", "https://api.upmind.com/clients")
    owner_id = os.getenv("CRM_OWNER_ID", "").strip()
    organization_id = os.getenv("CRM_ORGANIZATION_ID", "").strip()
    status = os.getenv("CRM_STATUS", "active").strip()
    client_type = os.getenv("CRM_CLIENT_TYPE", "customer").strip()
    output_path = os.getenv("OUTPUT_PATH", "upmind_clients_import.csv")

    headers = {"Authorization": f"Bearer {token}"}
    upmind_clients = fetch_all_clients(api_url, headers)

    rows: Iterable[Dict[str, str]] = (extract_client_fields(c) for c in upmind_clients)

    with open(output_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(
            [
                "name",
                "company",
                "email",
                "phone",
                "source",
                "notes_summary",
                "status",
                "client_type",
                "owner_id",
                "organization_id",
            ]
        )
        for row in rows:
            name = row["name"] or row["email"] or row["phone"] or "Unknown"
            writer.writerow(
                [
                    name,
                    row["company"],
                    row["email"],
                    row["phone"],
                    row["source"],
                    row["notes_summary"],
                    status,
                    client_type,
                    owner_id,
                    organization_id,
                ]
            )

    print(f"Exported {len(upmind_clients)} clients to {output_path}")


if __name__ == "__main__":
    main()
