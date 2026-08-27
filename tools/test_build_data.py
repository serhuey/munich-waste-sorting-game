#!/usr/bin/env python3
"""
Тесты билд-гейта.

    python3 tools/test_build_data.py

Каждый тест собирает крошечный репозиторий во временной папке: свои места,
свой снимок лексикона, свои предметы. Настоящие данные не трогаются.
"""

import copy, datetime, importlib.util, json, os, shutil, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("build_data", os.path.join(HERE, "build_data.py"))
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)

TODAY = datetime.date(2026, 8, 23)

PLACES = {
    "_source": {"url": "https://example.invalid/inseln", "fetched": "2026-08-23",
                "confirmed_by": "test"},
    "places": [
        {"id": "home", "tier": 1, "labels": {"de": "Zuhause", "en": "At home"},
         "containers": [
             {"id": "restmuell", "labels": {"de": "Restmüll", "en": "Residual"}},
             {"id": "papier", "labels": {"de": "Papier", "en": "Paper"}},
             {"id": "bio", "labels": {"de": "Bio", "en": "Organic"}},
             {"id": "gelbe_tonne", "from": "2027-01-01",
              "labels": {"de": "Gelbe Tonne", "en": "Yellow bin"}},
         ]},
        {"id": "insel", "tier": 3, "labels": {"de": "Insel", "en": "Island"},
         "containers": [
             {"id": "lvp", "until": "2027-01-01",
              "labels": {"de": "Leichtverpackungen", "en": "Light packaging"}},
         ]},
    ]
}

SNAPSHOT = {
    "source": "https://example.invalid",
    "fetched": "2026-08-23",
    "count": 1,
    "entries": [
        {"key": "pizzakarton", "term": "Pizzakarton",
         "destinations": ["papier", "wertstoffhof"], "labels": [], "tip": None,
         "notes": {}, "detail_url": None, "fingerprint": "abc123"},
    ],
}

ITEM = {
    "id": "pizzakarton",
    "tier": 1,
    "attrs": [],
    "labels": {"de": "Pizzakarton", "en": "Pizza box"},
    "source": {
        "authority": "awm",
        "key": "pizzakarton",
        "url": "https://example.invalid/pizzakarton",
        "destinations_at_verification": ["papier", "wertstoffhof"],
        "verified_by": "sergei",
        "verified_on": "2026-08-20",
    },
    "variants": [
        {"id": "sauber", "kind": "simple",
         "labels": {"de": "sauber", "en": "clean"}, "destinations": ["papier"]},
    ],
    "explanation": {"de": "Erklärung.", "en": "Explanation."},
}


class GateTest(unittest.TestCase):
    def setUp(self):
        self.repo = tempfile.mkdtemp(prefix="awm-test-")
        os.makedirs(os.path.join(self.repo, "data", "items"))
        os.makedirs(os.path.join(self.repo, "data", "verified"))
        self.write("data/places.json", PLACES)
        self.write("data/verified/lexikon-2026-08-23.json", SNAPSHOT)

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)

    def write(self, rel, data):
        with open(os.path.join(self.repo, rel), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def item(self, **changes):
        """Копия исправного предмета с точечными изменениями."""
        raw = copy.deepcopy(ITEM)
        for path, value in changes.items():
            node, *rest = path.split(".")
            if not rest:
                if value is bd:          # часовой: удалить поле
                    raw.pop(node, None)
                else:
                    raw[node] = value
            else:
                if value is bd:
                    raw[node].pop(rest[0], None)
                else:
                    raw[node][rest[0]] = value
        self.write("data/items/%s.json" % raw.get("id", "pizzakarton"), raw)
        return raw

    def build(self, date=TODAY):
        return bd.build(self.repo, date, today=TODAY)

    def excluded_reasons(self, report, stem="pizzakarton"):
        for name, problems in report["excluded"]:
            if name == stem:
                return problems
        return None

    # --- то, ради чего гейт существует -------------------------------------

    def test_valid_item_survives_and_lands_in_content(self):
        self.item()
        content, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"])
        self.assertEqual(report["excluded"], [])
        self.assertEqual([i["id"] for i in content["items"]], ["pizzakarton"])

    def test_missing_verified_on_is_excluded_and_named(self):
        self.item(**{"source.verified_on": bd})
        _, report = self.build()
        reasons = self.excluded_reasons(report)
        self.assertIsNotNone(reasons, "предмет без сверки обязан быть исключён")
        self.assertTrue(any("verified_on" in r and "R15" in r for r in reasons), reasons)

    def test_empty_verified_by_is_excluded(self):
        self.item(**{"source.verified_by": "   "})
        _, report = self.build()
        self.assertTrue(any("никто не сверял" in r for r in self.excluded_reasons(report)))

    def test_verification_dated_in_the_future_is_excluded(self):
        self.item(**{"source.verified_on": "2026-09-30"})
        _, report = self.build()
        self.assertTrue(any("в будущем" in r for r in self.excluded_reasons(report)))

    def test_key_absent_from_snapshot_is_excluded(self):
        self.item(**{"source.key": "kein-eintrag"})
        _, report = self.build()
        self.assertTrue(any("нет в свежем снимке" in r for r in self.excluded_reasons(report)))

    def test_drifted_destinations_are_excluded_and_both_sets_shown(self):
        self.item(**{"source.destinations_at_verification": ["papier"]})
        _, report = self.build()
        reason = " ".join(self.excluded_reasons(report))
        self.assertIn("изменились с момента сверки", reason)
        self.assertIn("было [papier]", reason)
        self.assertIn("стало [papier, wertstoffhof]", reason)

    # --- форма данных -------------------------------------------------------

    def test_unknown_destination_is_excluded(self):
        self.item(variants=[dict(ITEM["variants"][0], destinations=["gartenabfall"])])
        _, report = self.build()
        self.assertTrue(any("не объявлен ни в одном месте" in r
                            for r in self.excluded_reasons(report)))

    def test_nested_part_is_rejected_with_the_rule_named(self):
        composite = {
            "id": "mit_resten", "kind": "composite",
            "labels": {"de": "mit Resten", "en": "with residue"},
            "parts": [
                {"id": "karton", "labels": {"de": "Karton", "en": "Cardboard"},
                 "destinations": ["papier"]},
                {"id": "reste", "labels": {"de": "Reste", "en": "Residue"},
                 "destinations": ["bio"],
                 "variants": [{"id": "tief", "kind": "simple",
                               "labels": {"de": "x", "en": "x"}, "destinations": ["bio"]}]},
            ],
        }
        self.item(attrs=["separable"], variants=[composite])
        _, report = self.build()
        reason = " ".join(self.excluded_reasons(report))
        self.assertIn("вложенность запрещена", reason)
        self.assertIn("R14", reason)

    def test_composite_with_single_part_is_rejected(self):
        composite = {
            "id": "mit_resten", "kind": "composite",
            "labels": {"de": "mit Resten", "en": "with residue"},
            "parts": [{"id": "karton", "labels": {"de": "Karton", "en": "Cardboard"},
                       "destinations": ["papier"]}],
        }
        self.item(attrs=["separable"], variants=[composite])
        _, report = self.build()
        self.assertTrue(any("минимум две части" in r for r in self.excluded_reasons(report)))

    def test_two_variants_require_the_examine_attribute(self):
        second = {"id": "fettig", "kind": "simple",
                  "labels": {"de": "fettig", "en": "greasy"}, "destinations": ["bio"]}
        self.item(variants=[ITEM["variants"][0], second])
        _, report = self.build()
        self.assertTrue(any("examine" in r for r in self.excluded_reasons(report)))

    def test_composite_requires_the_separable_attribute(self):
        composite = {
            "id": "mit_resten", "kind": "composite",
            "labels": {"de": "mit Resten", "en": "with residue"},
            "parts": [
                {"id": "karton", "labels": {"de": "Karton", "en": "Cardboard"},
                 "destinations": ["papier"]},
                {"id": "reste", "labels": {"de": "Reste", "en": "Residue"},
                 "destinations": ["bio"]},
            ],
        }
        self.item(variants=[composite])
        _, report = self.build()
        self.assertTrue(any("separable" in r for r in self.excluded_reasons(report)))

    def test_missing_language_is_excluded(self):
        self.item(**{"explanation.en": bd})
        _, report = self.build()
        self.assertTrue(any("на языке en" in r for r in self.excluded_reasons(report)))

    def test_id_must_match_filename(self):
        raw = copy.deepcopy(ITEM)
        raw["id"] = "anderer_name"
        self.write("data/items/pizzakarton.json", raw)
        _, report = self.build()
        self.assertTrue(any("не совпадает с именем файла" in r
                            for r in self.excluded_reasons(report)))

    def test_files_starting_with_underscore_are_ignored(self):
        self.write("data/items/_example.json", {"nonsense": True})
        content, report = self.build()
        self.assertEqual(report["excluded"], [])
        self.assertEqual(content["items"], [])

    # --- источники, которых нет в лексиконе ------------------------------

    LAW = {
        "authority": "law",
        "reference": "BattG § 9 Abs. 1",
        "url": "https://www.gesetze-im-internet.de/battg/__9.html",
        "verified_by": "sergei",
        "verified_on": "2026-08-20",
    }

    def test_law_only_source_is_accepted(self):
        self.item(id="pfandflasche", source=dict(self.LAW, reference="VerpackG § 31"))
        _, report = self.build()
        self.assertEqual(report["included"], ["pfandflasche"], report["excluded"])

    def test_law_source_without_a_norm_is_excluded(self):
        law = dict(self.LAW); law.pop("reference")
        self.item(id="pfandflasche", source=law)
        _, report = self.build()
        self.assertTrue(any("reference" in r for r in self.excluded_reasons(report, "pfandflasche")))

    def test_law_source_may_not_carry_a_lexicon_key(self):
        self.item(id="pfandflasche", source=dict(self.LAW, key="pizzakarton"))
        _, report = self.build()
        self.assertTrue(any("лишнее" in r for r in self.excluded_reasons(report, "pfandflasche")))

    def test_second_source_is_validated_too(self):
        self.item(sources=[dict(self.LAW, verified_on="")])
        _, report = self.build()
        reasons = self.excluded_reasons(report)
        self.assertTrue(any("sources[0]" in r for r in reasons), reasons)

    def test_awm_item_may_carry_an_additional_law_source(self):
        self.item(sources=[self.LAW])
        _, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"], report["excluded"])

    # --- переход 1 января 2027 ---------------------------------------------

    def test_item_bound_to_a_retiring_container_warns_about_the_switch(self):
        self.item(id="joghurtbecher", tier=3,
                  variants=[{"id": "becher", "kind": "simple",
                             "labels": {"de": "Becher", "en": "Pot"},
                             "destinations": ["lvp"]}])
        _, report = self.build()
        self.assertEqual(report["included"], ["joghurtbecher"])
        self.assertTrue(any("2027-01-01" in w for w in report["warnings"]), report["warnings"])

    def test_the_same_item_is_excluded_when_built_after_the_switch(self):
        self.item(id="joghurtbecher", tier=3,
                  variants=[{"id": "becher", "kind": "simple",
                             "labels": {"de": "Becher", "en": "Pot"},
                             "destinations": ["lvp"]}])
        _, report = self.build(date=datetime.date(2027, 1, 15))
        self.assertTrue(any("ни один адресат не действует" in r
                            for r in self.excluded_reasons(report, "joghurtbecher")))

    def test_dated_destination_survives_the_switch(self):
        self.item(id="joghurtbecher", tier=3,
                  variants=[{"id": "becher", "kind": "simple",
                             "labels": {"de": "Becher", "en": "Pot"},
                             "destinations": [
                                 {"id": "lvp", "until": "2027-01-01"},
                                 {"id": "gelbe_tonne", "from": "2027-01-01"}]}])
        _, before = self.build()
        _, after = self.build(date=datetime.date(2027, 1, 15))
        self.assertEqual(before["included"], ["joghurtbecher"])
        self.assertEqual(after["included"], ["joghurtbecher"])
        self.assertEqual(before["warnings"], [])

    # --- фатальные ситуации -------------------------------------------------

    def test_missing_snapshot_is_fatal(self):
        os.remove(os.path.join(self.repo, "data", "verified", "lexikon-2026-08-23.json"))
        self.item()
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("нет снимка" in f for f in report["fatal"]))

    def test_unconfirmed_places_file_warns(self):
        import copy as _copy
        places = _copy.deepcopy(PLACES)
        places["_source"]["confirmed_by"] = ""
        self.write("data/places.json", places)
        self.item()
        _, report = self.build()
        self.assertTrue(any("никем не подтверждён" in w for w in report["warnings"]),
                        report["warnings"])

    def test_duplicate_container_id_is_fatal(self):
        places = copy.deepcopy(PLACES)
        places["places"][1]["containers"].append({"id": "papier",
                                                  "labels": {"de": "x", "en": "x"}})
        self.write("data/places.json", places)
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("объявлен дважды" in f for f in report["fatal"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
