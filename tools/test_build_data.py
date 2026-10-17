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
        {"id": "shop", "tier": 2, "labels": {"de": "Laden", "en": "Shop"},
         "containers": [
             {"id": "pfandautomat", "labels": {"de": "Pfandautomat", "en": "Deposit machine"}},
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
        os.makedirs(os.path.join(self.repo, "data", "i18n"))
        os.makedirs(os.path.join(self.repo, "data", "finale"))
        self.write("data/places.json", PLACES)
        self.write("data/verified/lexikon-2026-08-23.json", SNAPSHOT)
        self.write("data/i18n/de.json", {"play": "Spielen", "tier": "Stufe {n}"})
        self.write("data/i18n/en.json", {"play": "Play", "tier": "Level {n}"})

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

    def test_a_lone_variant_needs_no_name(self):
        lone = {"id": "standard", "kind": "simple", "destinations": ["papier"]}
        self.item(variants=[lone])
        _, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"], report["excluded"])

    def test_two_variants_must_both_be_named(self):
        self.item(attrs=["examine"], variants=[
            {"id": "a", "kind": "simple", "labels": {"de": "sauber", "en": "clean"},
             "destinations": ["papier"]},
            {"id": "b", "kind": "simple", "destinations": ["restmuell"]},
        ])
        _, report = self.build()
        reasons = self.excluded_reasons(report)
        self.assertTrue(any("variants[1] labels" in r for r in reasons), reasons)
        self.assertFalse(any("variants[0] labels" in r for r in reasons), reasons)

    def test_variant_reason_is_optional_but_must_be_complete(self):
        good = dict(ITEM["variants"][0], explanation={"de": "warum", "en": "why"})
        self.item(variants=[good])
        _, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"], report["excluded"])

        half = dict(ITEM["variants"][0], explanation={"de": "warum"})
        self.item(variants=[half])
        _, report = self.build()
        self.assertTrue(any("variants[0] explanation" in r
                            for r in self.excluded_reasons(report)), report["excluded"])

    def test_part_reason_is_optional_but_must_be_complete(self):
        composite = {
            "id": "mit_resten", "kind": "composite",
            "labels": {"de": "mit Resten", "en": "with residue"},
            "parts": [
                {"id": "karton", "labels": {"de": "Karton", "en": "Cardboard"},
                 "destinations": ["papier"], "explanation": {"de": "sauber", "en": "clean"}},
                {"id": "reste", "labels": {"de": "Reste", "en": "Residue"},
                 "destinations": ["bio"], "explanation": {"en": "only english"}},
            ],
        }
        self.item(attrs=["separable"], variants=[composite])
        _, report = self.build()
        self.assertTrue(any("parts[1] explanation" in r
                            for r in self.excluded_reasons(report)), report["excluded"])

    def test_destination_in_a_locked_place_is_excluded(self):
        # У острова tier 3: на первом тире его контейнеров на ленте нет.
        self.item(tier=1, variants=[{"id": "s", "kind": "simple",
                                     "labels": {"de": "a", "en": "b"},
                                     "destinations": ["lvp"]}])
        _, report = self.build()
        self.assertTrue(any("место ещё" in r for r in self.excluded_reasons(report)),
                        report["excluded"])

    def test_the_same_destination_is_fine_on_its_own_tier(self):
        self.item(tier=3, variants=[{"id": "s", "kind": "simple",
                                     "labels": {"de": "a", "en": "b"},
                                     "destinations": ["lvp"]}])
        _, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"], report["excluded"])

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

    def test_a_page_source_is_accepted(self):
        page = {"authority": "page",
                "reference": "Wertstoffinseln: was in welchen Container gehört",
                "url": "https://www.awm-muenchen.de/abfall-entsorgen/abgabestellen/wertstoffinseln",
                "verified_by": "sergei", "verified_on": "2026-08-20"}
        self.item(sources=[page])
        _, report = self.build()
        self.assertEqual(report["included"], ["pizzakarton"], report["excluded"])

    def test_a_page_source_needs_a_name_and_no_lexicon_key(self):
        page = {"authority": "page", "url": "https://example.invalid/x",
                "key": "pizzakarton", "verified_by": "sergei", "verified_on": "2026-08-20"}
        self.item(sources=[page])
        _, report = self.build()
        reasons = " ".join(self.excluded_reasons(report))
        self.assertIn("reference", reasons)
        self.assertIn("лишнее", reasons)

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

    # --- лестница тиров (U6) ------------------------------------------------

    def test_two_places_on_one_tier_are_fatal(self):
        places = copy.deepcopy(PLACES)
        places["places"][1]["tier"] = 1
        self.write("data/places.json", places)
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("занят дважды" in f for f in report["fatal"]), report["fatal"])

    def test_a_gap_in_the_tiers_is_fatal(self):
        places = copy.deepcopy(PLACES)
        places["places"].pop(1)          # убрали вторую ступень, остались 1 и 3
        self.write("data/places.json", places)
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("с пропусками" in f for f in report["fatal"]), report["fatal"])

    def test_a_place_without_a_tier_is_fatal(self):
        places = copy.deepcopy(PLACES)
        places["places"][0].pop("tier")
        self.write("data/places.json", places)
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("tier должен быть" in f for f in report["fatal"]), report["fatal"])

    def test_the_real_ladder_holds(self):
        """Настоящий data/places.json — те же правила, без временной песочницы.

        Остальные тесты работают на выдуманных данных, и лестница из них ничего
        не говорит о лестнице, в которую играют. Эта проверка читает файл из
        репозитория.
        """
        repo = os.path.dirname(HERE)
        places, _, fatal = bd.load_places(repo)
        self.assertEqual(fatal, [])
        tiers = sorted(p["tier"] for p in places)
        self.assertEqual(tiers, list(range(1, len(places) + 1)))

    def test_a_signed_item_with_an_unsigned_new_source_stays_on_the_stand(self):
        self.item(sources=[{"authority": "law", "reference": "X § 1", "url": "https://example.invalid",
                            "verified_by": "", "verified_on": ""}])
        content, report = self.build()
        self.assertEqual(content["items"], [], "в выпуск без подписи не идёт")
        content, report = bd.build(self.repo, TODAY, today=TODAY, fixtures=True)
        self.assertEqual([i["id"] for i in content["items"]], ["pizzakarton"])
        self.assertTrue(content["items"][0]["unverified"])

    # --- языки, финал, сообщения --------------------------------------------

    def test_a_missing_interface_key_is_fatal(self):
        self.write("data/i18n/en.json", {"play": "Play"})
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("нет ключа tier" in f for f in report["fatal"]), report["fatal"])

    def test_a_third_language_needs_only_a_file(self):
        self.write("data/i18n/fr.json", {"play": "Jouer", "tier": "Niveau {n}"})
        content, _ = self.build()
        self.assertEqual(sorted(content["i18n"]), ["de", "en", "fr"])

    def test_a_placeholder_that_differs_between_languages_is_fatal(self):
        self.write("data/i18n/en.json", {"play": "Play", "tier": "Level {level}"})
        content, report = self.build()
        self.assertIsNone(content)
        self.assertTrue(any("подстановки" in f for f in report["fatal"]), report["fatal"])

    def finale(self, signed=True, year_round=True):
        src = {"authority": "page", "reference": "x", "url": "https://example.invalid",
               "verified_by": "test" if signed else "", "verified_on": "2026-08-20"}
        text = {"de": "x", "en": "x"}
        routes = [{"id": "hof", "labels": text, "rule": text,
                   **({"year_round": True} if year_round else {"windows": [{"from": "2026-01-07", "until": "2026-02-05"}]})},
                  {"id": "strasse", "illegal": True, "labels": text, "rule": text}]
        self.write("data/finale/christbaum.json", {"sources": [src], "routes": routes,
                   "decorations": [], "strip_reason": text, "scenes": ["2026-01-08"]})

    def test_a_signed_finale_ships(self):
        self.finale()
        content, _ = self.build()
        self.assertEqual([r["id"] for r in content["finale"]["routes"]], ["hof", "strasse"])

    def test_an_unsigned_finale_stays_on_the_stand(self):
        self.finale(signed=False)
        content, report = self.build()
        self.assertIsNone(content["finale"])
        self.assertTrue(any(name == "финал" for name, _ in report["excluded"]))
        content, _ = bd.build(self.repo, TODAY, today=TODAY, fixtures=True)
        self.assertTrue(content["finale"]["unverified"])

    def test_a_finale_without_a_year_round_route_is_refused(self):
        self.finale(year_round=False)
        content, report = self.build()
        self.assertIsNone(content["finale"])
        problems = dict(report["excluded"])["финал"]
        self.assertTrue(any("круглогодичного" in p for p in problems), problems)

    def test_the_intro_must_not_outlive_the_rules_it_describes(self):
        text = {"de": "x", "en": "x"}
        src = {"authority": "page", "reference": "x", "url": "https://example.invalid",
               "verified_by": "test", "verified_on": "2026-08-20"}
        self.write("data/notices.json", {"_source": src, "intro": [{"text": text}], "notices": []})
        _, report = self.build()
        self.assertFalse(any(name == "сообщения" for name, _ in report["excluded"]))
        self.write("data/notices.json", {"_source": src, "intro": [{"until": "2027-01-01", "text": text}],
                                         "notices": []})
        content, report = self.build()
        self.assertIsNone(content["notices"])
        problems = dict(report["excluded"])["сообщения"]
        self.assertTrue(any("ровно одна" in p for p in problems), problems)

    def test_the_real_languages_and_finale_hold(self):
        repo = os.path.dirname(HERE)
        _, fatal = bd.load_i18n(repo)
        self.assertEqual(fatal, [])
        _, problems = bd.load_finale(repo)
        self.assertEqual(problems, [])
        _, problems = bd.load_notices(repo, TODAY)
        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
