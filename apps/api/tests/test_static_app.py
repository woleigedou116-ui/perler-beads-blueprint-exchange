def test_root_serves_web_application(client) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "拼豆图纸标准转换" in response.text
