from app.config import Settings, target_locale_from_settings


def test_target_locale_explicit():
    s = Settings(
        lang_target_locale="fr-FR",
        tts_voice_target="es_ES-davefx-medium",
    )
    assert target_locale_from_settings(s) == "fr-FR"


def test_target_locale_from_voice():
    s = Settings(lang_target_locale=None, tts_voice_target="es_ES-davefx-medium")
    assert target_locale_from_settings(s) == "es-ES"


def test_target_locale_simple_prefix():
    s = Settings(lang_target_locale=None, tts_voice_target="de")
    assert target_locale_from_settings(s) == "de"


def test_tutor_prompt_contains_langs():
    s = Settings(lang_target="X", lang_ui="Y", cefr_level="A1")
    from app.services.ollama import tutor_system_prompt

    p = tutor_system_prompt(s)
    assert "X" in p and "Y" in p and "A1" in p


def test_gloss_user_message_json():
    from app.services.ollama import gloss_user_message

    m = gloss_user_message("  hola  ", "  ctx  ")
    assert "hola" in m and "ctx" in m


def test_vocab_pack_user_message():
    from app.services.ollama import vocab_pack_user_message

    assert "food" in vocab_pack_user_message("food", 5)
    assert "count" in vocab_pack_user_message(None, 3)


def test_resolve_model_tiers():
    from app.services.ollama import resolve_model

    s = Settings(llm_model="base", llm_model_fast="fast", llm_model_strong="strong")
    assert resolve_model(s, None) == "base"
    assert resolve_model(s, "fast") == "fast"
    assert resolve_model(s, "strong") == "strong"
    s2 = Settings(llm_model="only", llm_model_fast=None, llm_model_strong=None)
    assert resolve_model(s2, "fast") == "only"
