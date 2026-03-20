// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { parseFormStructure } from './parseFormStructure';

// ── Minimal fixture ──────────────────────────────────────────────────────────

const MINIMAL_FORM_XML = `<form>
  <tabs>
    <tab name="tab1">
      <labels><label description="General" languagecode="1033" /></labels>
      <columns><column><sections>
        <section name="section1">
          <labels><label description="Contact Information" languagecode="1033" /></labels>
          <rows>
            <row>
              <cell>
                <labels><label description="First Name" languagecode="1033" /></labels>
                <control id="firstname" datafieldname="firstname" />
              </cell>
              <cell>
                <labels><label description="Last Name" languagecode="1033" /></labels>
                <control id="lastname" datafieldname="lastname" />
              </cell>
            </row>
          </rows>
        </section>
      </sections></column></columns>
    </tab>
  </tabs>
  <formLibraries>
    <Library name="new_/js/contact.js" displayName="Contact Scripts" />
  </formLibraries>
  <events>
    <event name="onload">
      <Handlers>
        <Handler functionName="Contact.onLoad" libraryName="new_/js/contact.js" />
      </Handlers>
    </event>
    <event name="onchange" attribute="firstname">
      <Handlers>
        <Handler functionName="Contact.onChange" libraryName="new_/js/contact.js" />
      </Handlers>
    </event>
  </events>
</form>`;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseFormStructure', () => {
  it('returns empty structure for null', () => {
    expect(parseFormStructure(null)).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('returns empty structure for undefined', () => {
    expect(parseFormStructure(undefined)).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('returns empty structure for invalid XML', () => {
    expect(parseFormStructure('not-xml')).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('returns empty structure for malformed XML', () => {
    expect(parseFormStructure('<form><unclosed>')).toEqual({ tabs: [], libraries: [], events: [] });
  });

  it('parses tabs and sections', () => {
    const result = parseFormStructure(MINIMAL_FORM_XML);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].name).toBe('tab1');
    expect(result.tabs[0].label).toBe('General');
    expect(result.tabs[0].sections).toHaveLength(1);
    expect(result.tabs[0].sections[0].name).toBe('section1');
    expect(result.tabs[0].sections[0].label).toBe('Contact Information');
  });

  it('parses fields with logicalName and label', () => {
    const result = parseFormStructure(MINIMAL_FORM_XML);
    const fields = result.tabs[0].sections[0].fields;
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ logicalName: 'firstname', label: 'First Name', isPcf: false });
    expect(fields[1]).toEqual({ logicalName: 'lastname',  label: 'Last Name',  isPcf: false });
  });

  it('parses libraries with displayName', () => {
    const result = parseFormStructure(MINIMAL_FORM_XML);
    expect(result.libraries).toEqual([
      { webResourceName: 'new_/js/contact.js', displayName: 'Contact Scripts' },
    ]);
  });

  it('library without displayName falls back to name', () => {
    const xml = `<form>
      <tabs></tabs>
      <formLibraries><Library name="new_/js/utils.js" /></formLibraries>
      <events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.libraries[0]).toEqual({ webResourceName: 'new_/js/utils.js', displayName: 'new_/js/utils.js' });
  });

  it('parses OnLoad event — field is null', () => {
    const result = parseFormStructure(MINIMAL_FORM_XML);
    expect(result.events[0]).toEqual({
      event: 'OnLoad', field: null, functionName: 'Contact.onLoad', libraryName: 'new_/js/contact.js',
    });
  });

  it('parses OnChange event — field is set', () => {
    const result = parseFormStructure(MINIMAL_FORM_XML);
    expect(result.events[1]).toEqual({
      event: 'OnChange', field: 'firstname', functionName: 'Contact.onChange', libraryName: 'new_/js/contact.js',
    });
  });

  it('normalises event names (onload → OnLoad, onsave → OnSave)', () => {
    const xml = `<form>
      <tabs></tabs>
      <formLibraries></formLibraries>
      <events>
        <event name="onsave">
          <Handlers><Handler functionName="Ns.onSave" libraryName="new_/js/lib.js" /></Handlers>
        </event>
      </events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.events[0].event).toBe('OnSave');
  });

  it('skips cells without a control element', () => {
    const xml = `<form>
      <tabs><tab name="t1">
        <labels><label description="T" languagecode="1033" /></labels>
        <columns><column><sections>
          <section name="s1">
            <labels><label description="S" languagecode="1033" /></labels>
            <rows><row>
              <cell>
                <labels><label description="No control" languagecode="1033" /></labels>
              </cell>
              <cell>
                <labels><label description="Has control" languagecode="1033" /></labels>
                <control id="name" datafieldname="name" />
              </cell>
            </row></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries>
      <events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].sections[0].fields).toHaveLength(1);
    expect(result.tabs[0].sections[0].fields[0].logicalName).toBe('name');
  });

  it('falls back to control id when datafieldname is absent', () => {
    const xml = `<form>
      <tabs><tab name="t1">
        <columns><column><sections>
          <section name="s1">
            <rows><row>
              <cell><control id="myfield" /></cell>
            </row></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].sections[0].fields[0].logicalName).toBe('myfield');
  });

  it('falls back to logicalName when cell has no labels', () => {
    const xml = `<form>
      <tabs><tab name="t1">
        <columns><column><sections>
          <section name="s1">
            <rows><row>
              <cell><control id="indskr_name" datafieldname="indskr_name" /></cell>
            </row></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    const field = result.tabs[0].sections[0].fields[0];
    expect(field.logicalName).toBe('indskr_name');
    expect(field.label).toBe('indskr_name');
  });

  it('falls back to tab name when tab has no labels', () => {
    const xml = `<form>
      <tabs><tab name="tab_general"><columns></columns></tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].label).toBe('tab_general');
  });

  it('falls back to section name when section has no labels', () => {
    const xml = `<form>
      <tabs><tab name="t1">
        <columns><column><sections>
          <section name="header">
            <rows></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].sections[0].name).toBe('header');
    expect(result.tabs[0].sections[0].label).toBe('header');
  });

  it('marks PCF controls via classid', () => {
    const PCF_CLASS_ID = '{F9A8A302-114E-466A-B582-6771B2AE0D92}';
    const xml = `<form>
      <tabs><tab name="t1">
        <columns><column><sections>
          <section name="s1">
            <rows><row>
              <cell>
                <labels><label description="Rating" languagecode="1033" /></labels>
                <control id="new_rating" datafieldname="new_rating" classid="${PCF_CLASS_ID}" />
              </cell>
            </row></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].sections[0].fields[0].isPcf).toBe(true);
  });

  it('non-PCF controls have isPcf false', () => {
    const STANDARD_CLASS_ID = '{270BD3DB-D9AF-4782-9025-509E298DEC0A}';
    const xml = `<form>
      <tabs><tab name="t1">
        <columns><column><sections>
          <section name="s1">
            <rows><row>
              <cell>
                <labels><label description="Name" languagecode="1033" /></labels>
                <control id="name" datafieldname="name" classid="${STANDARD_CLASS_ID}" />
              </cell>
            </row></rows>
          </section>
        </sections></column></columns>
      </tab></tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs[0].sections[0].fields[0].isPcf).toBe(false);
  });

  it('parses multiple tabs and multiple sections per tab', () => {
    const xml = `<form>
      <tabs>
        <tab name="tab_main">
          <labels><label description="Main" languagecode="1033" /></labels>
          <columns><column><sections>
            <section name="s1"><labels><label description="Info" languagecode="1033" /></labels><rows></rows></section>
            <section name="s2"><labels><label description="Details" languagecode="1033" /></labels><rows></rows></section>
          </sections></column></columns>
        </tab>
        <tab name="tab_extra">
          <labels><label description="Extra" languagecode="1033" /></labels>
          <columns><column><sections>
            <section name="s3"><labels><label description="Other" languagecode="1033" /></labels><rows></rows></section>
          </sections></column></columns>
        </tab>
      </tabs>
      <formLibraries></formLibraries><events></events>
    </form>`;
    const result = parseFormStructure(xml);
    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[0].sections).toHaveLength(2);
    expect(result.tabs[1].sections).toHaveLength(1);
    expect(result.tabs[0].sections[1].label).toBe('Details');
  });
});
