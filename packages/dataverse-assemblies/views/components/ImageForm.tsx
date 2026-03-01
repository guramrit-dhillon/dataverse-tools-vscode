import * as React from "react";
import { useState } from "react";
import { Field, Modal } from "shared-views";

export interface StepImage {
  sdkmessageprocessingstepimageid?: string;
  name: string;
  entityalias: string;
  imagetype: number; // 0=PreImage, 1=PostImage, 2=Both
  attributes?: string;
  messagepropertyname: string;
}

export function imageTypeLabel(t: number): string {
  return ({ 0: "Pre-Image", 1: "Post-Image", 2: "Pre+Post" } as Record<number, string>)[t] ?? String(t);
}

interface ImageFormState {
  name: string;
  entityalias: string;
  imagetype: number;
  attributes: string;
  messagepropertyname: string;
}

function blankImageForm(): ImageFormState {
  return { name: "", entityalias: "", imagetype: 0, attributes: "", messagepropertyname: "Target" };
}

export function ImageForm({
  image,
  onSave,
  onCancel,
}: {
  image: StepImage | null;
  onSave: (img: StepImage) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<ImageFormState>(
    image
      ? {
          name: image.name,
          entityalias: image.entityalias,
          imagetype: image.imagetype,
          attributes: image.attributes ?? "",
          messagepropertyname: image.messagepropertyname,
        }
      : blankImageForm()
  );

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSave({
      ...(image ?? {}),
      name: form.name,
      entityalias: form.entityalias,
      imagetype: form.imagetype,
      attributes: form.attributes || undefined,
      messagepropertyname: form.messagepropertyname,
    });
  };

  return (
    <Modal title={image ? "Edit Image" : "Add Image"} onClose={onCancel} className="image-dialog">
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Name *" as="input" fieldId="imgName"
          type="text" required value={form.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <Field label="Entity Alias *" as="input" fieldId="imgAlias"
          type="text" required value={form.entityalias} placeholder="e.g. PreImage"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, entityalias: e.target.value }))}
        />
        <Field label="Image Type *" as="select" fieldId="imgType"
          value={String(form.imagetype)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, imagetype: Number(e.target.value) }))}
        >
          <option value="0">Pre-Image</option>
          <option value="1">Post-Image</option>
          <option value="2">Pre+Post (Both)</option>
        </Field>
        <Field label="Message Property Name" as="input" fieldId="imgMsgProp"
          type="text" value={form.messagepropertyname}
          hint={'"Target" for most messages; "Id" for Delete.'}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, messagepropertyname: e.target.value }))}
        />
        <Field label="Attributes" as="input" fieldId="imgAttrs"
          type="text" value={form.attributes} placeholder="comma-separated logical names (empty = all)"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, attributes: e.target.value }))}
        />
        <div className="picker-actions">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary">{image ? "Update" : "Add"}</button>
        </div>
      </form>
    </Modal>
  );
}
