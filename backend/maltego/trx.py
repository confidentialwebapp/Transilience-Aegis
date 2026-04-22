"""Maltego TRX XML helpers — request parsing and response building."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TRXEntity:
    """Outbound entity returned to Maltego."""
    entity_type: str            # e.g. "maltego.IPv4Address", "maltego.Domain"
    value: str
    weight: int = 100
    icon_url: Optional[str] = None
    additional_fields: dict[str, str] = field(default_factory=dict)
    display_info: dict[str, str] = field(default_factory=dict)  # title -> html

    def to_xml(self, parent: ET.Element) -> None:
        ent = ET.SubElement(parent, "Entity", Type=self.entity_type)
        ET.SubElement(ent, "Value").text = self.value
        ET.SubElement(ent, "Weight").text = str(self.weight)
        if self.icon_url:
            ET.SubElement(ent, "IconURL").text = self.icon_url
        if self.additional_fields:
            af = ET.SubElement(ent, "AdditionalFields")
            for name, val in self.additional_fields.items():
                f = ET.SubElement(af, "Field", Name=name, DisplayName=name.replace("_", " ").title())
                f.text = str(val)
        if self.display_info:
            di = ET.SubElement(ent, "DisplayInformation")
            for label, html in self.display_info.items():
                lab = ET.SubElement(di, "Label", Name=label, Type="text/html")
                lab.text = f"<![CDATA[{html}]]>"


@dataclass
class TRXRequest:
    entity_type: str
    value: str
    fields: dict[str, str]
    soft_limit: int = 100
    hard_limit: int = 10000


def parse_request(xml_bytes: bytes) -> TRXRequest:
    """Parse a MaltegoTransformRequestMessage XML body."""
    root = ET.fromstring(xml_bytes)
    ent = root.find(".//Entity")
    if ent is None:
        raise ValueError("no <Entity> in request")
    entity_type = ent.attrib.get("Type", "maltego.Phrase")
    value_el = ent.find("Value")
    value = (value_el.text or "").strip() if value_el is not None else ""
    fields: dict[str, str] = {}
    for f in ent.findall(".//AdditionalFields/Field"):
        if f.attrib.get("Name") and f.text:
            fields[f.attrib["Name"]] = f.text
    limits = root.find(".//Limits")
    soft = int(limits.attrib.get("SoftLimit", "100")) if limits is not None else 100
    hard = int(limits.attrib.get("HardLimit", "10000")) if limits is not None else 10000
    return TRXRequest(entity_type=entity_type, value=value, fields=fields, soft_limit=soft, hard_limit=hard)


def build_response(entities: list[TRXEntity], message: Optional[str] = None) -> bytes:
    """Build a MaltegoTransformResponseMessage XML body."""
    msg = ET.Element("MaltegoMessage")
    resp = ET.SubElement(msg, "MaltegoTransformResponseMessage")
    ents_el = ET.SubElement(resp, "Entities")
    for e in entities:
        e.to_xml(ents_el)
    if message:
        ui = ET.SubElement(resp, "UIMessages")
        m = ET.SubElement(ui, "UIMessage", MessageType="Inform")
        m.text = message
    return ET.tostring(msg, encoding="utf-8", xml_declaration=True)


def build_error(message: str) -> bytes:
    msg = ET.Element("MaltegoMessage")
    err = ET.SubElement(msg, "MaltegoTransformExceptionMessage")
    excs = ET.SubElement(err, "Exceptions")
    ET.SubElement(excs, "Exception").text = message
    return ET.tostring(msg, encoding="utf-8", xml_declaration=True)
