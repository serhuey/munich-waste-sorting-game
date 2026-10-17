# Verifying an item

Nothing enters the game because someone was fairly sure. This is the loop that
turns an entry in AWM's Abfalllexikon into a game item, and the reason the build
refuses anything that has not been through it (R15).

## The loop

```bash
python3 tools/awm_lexikon.py fetch --details    # refresh the snapshot (once in a while)
python3 tools/drafts.py new <lexicon-key> --tier 1 --id <short-id>
```

The draft lands in `data/drafts/` and carries what a machine can know: the lexicon
key, the link, the German term, AWM's own tip, and the destinations the snapshot
sees today. Then, by hand:

1. **Open `source.url` and read the entry.** Not the snapshot — the page. The
   snapshot is derived from it and can be wrong in ways only reading catches.
2. **Fill `destinations` in each variant.** These are the game's destinations —
   container ids from `data/places.json` — not AWM's routes. AWM offers a
   Wertstoffhof for almost everything; the game names the container a person
   actually walks to.
3. **Write `explanation` in German and English.** The reason, not the rule. When
   several destinations are correct, say so — the game shows the others even
   after a correct answer (R8).

   There are three places a reason can live, and they answer different
   questions. The item's is required and says what the whole thing teaches —
   for two bottles, that the word on the label decides. A variant may carry its
   own, saying why this version differs from its neighbour. A part of a
   composite item may carry one too, saying why that piece goes where it goes.
   The game shows whichever exist, from the most specific to the most general.
   Only the item's is mandatory; write the others when the object earns them.
4. **Fill `labels.en`**, and the variant labels if there is more than one.
5. **Sign it:** `verified_by` and `verified_on`.

```bash
python3 tools/drafts.py promote <short-id>      # validates, then moves into data/items/
python3 tools/build_data.py --check
```

`promote` refuses a draft that does not pass the gate, and prints why.

## What the gate does and does not do

It rejects an item with no signature, a signature dated in the future, a lexicon
key that no longer exists, or destinations that have drifted in the source since
the day it was signed.

It cannot tell whether you actually read the page. The signature is a claim by a
person, and the whole design rests on that claim being worth something. An agent
must never fill in `verified_by` — that is the one line in this repository where
automation is the failure mode rather than the goal.

## Choosing what to verify

The set is curated, not exhaustive. A good item is one a newcomer gets wrong:

- The answer contradicts the name. *Backpapier* and *Papiertaschentuch* are not
  paper; *Biotüte* is not organic waste.
- The answer is written on the object rather than derivable from it — the receipt
  that is blue or thermal, the bottle marked `Pfand` or `Pfandfrei`. These carry
  `examine`.
- The object is not one answer but several. These carry `separable`.
- The destination is somewhere you would not think to carry it — the shop above
  all.

AWM's own `tip` field, preserved in the snapshot, flags many of these: 49 entries
carry one.

## Sources that are AWM but not the lexicon

Some rules live on an ordinary AWM page rather than in the Abfalllexikon: what
stands at a Wertstoffinsel, or what moves where on 1 January 2027. Those carry
`"authority": "page"` with the page's name in `source.reference` and its address
in `source.url`. They are read and signed exactly like a lexicon entry; what they
skip is the snapshot comparison, because a page is not an entry with a key.

## Sources that are not AWM

Take-back at shops rests on federal law, not on the city: the battery law
obliges every retailer selling batteries to accept them back, and the ElektroG
obliges retailers above a sales-floor threshold to accept lamps and small
electronics under 25 cm. Those items carry `"authority": "law"` with the norm in
`source.reference` and no lexicon key, and are verified against the legislation.

Two of the norms this project first cited have since been replaced by laws
implementing EU regulations, and their old addresses on gesetze-im-internet.de
return 404 (checked 14 October 2026): the Batteriegesetz by the
Batterierecht-Durchführungsgesetz — retailer take-back is now **BattDG § 14** —
and the Verpackungsgesetz by the Verpackungsrecht-Durchführungsgesetz — the
deposit on single-use drinks packaging is now **VerpackDG § 46**. New drafts cite
the new norms. Signed items that still cite `VerpackG § 31` need a person to
re-read the new paragraph and re-sign; the build cannot see a dead link.

## Everything else that needs a signature

`tools/verify_ui.py` lists drafts on the left and, under **Прочее**, the
signatures that are not drafts: the composition of places in
`data/places.json`, items already in the game that gained an unsigned source,
the finale and the 2027 notice. Each shows what the signature confirms, links
the source and writes the name and date into the same fields the build checks.

## Drafts written by machine

A draft with `"_drafted_by": "claude"` was written from the lexicon snapshot,
AWM's own pages and the norms above, so that the game could be played end to end
before the content is verified. It names its source and fills in what the source
says, and it is wrong in the way any draft can be wrong: nobody has read the page
on its behalf. Treat it exactly like a draft you created yourself — open the
source, check every destination and sentence, then sign. Where a person had
already signed a source and the machine added to the draft afterwards, the draft
says so in `_changed_after_signature`.

The finale (`data/finale/christbaum.json`) and the 2027 notice
(`data/notices.json`) follow the same rule: unsigned, they appear only in a
`--fixtures` build.

## When AWM changes something

```bash
python3 tools/awm_lexikon.py fetch --details
python3 tools/awm_lexikon.py diff --latest
python3 tools/build_data.py --check
```

The diff names entries whose destinations moved; the build then excludes exactly
the items that were signed against the old answer. Re-read those pages, correct
the item, and set a new `verified_on`.
